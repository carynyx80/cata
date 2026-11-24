import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Card } from "./types.js";
import { gradeFromNumber, valueAt } from "./pricing.js";

export const SCAN_MODEL = process.env.SCAN_MODEL || "claude-opus-5-5";

export const ScanResult = z.object({
  isTradingCard: z.boolean(),
  game: z.enum(["pokemon", "magic", "yugioh", "onepiece", "sports", "unknown"]),
  name: z.string(),
  set: z.string(),
  number: z.string(),
  conditionNotes: z.string(),
  estimatedGrade: z.number(),
  alreadyGraded: z.object({ grader: z.string(), grade: z.string(), cert: z.string() }).nullable(),
});
export type ScanResult = z.infer<typeof ScanResult>;

export type ImageMedia = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

const PROMPT = `You are a trading-card identifier and pre-grader for a graded-card shop.
Identify the card in the photo: game (pokemon, magic, yugioh, onepiece, sports, or unknown), exact card name as printed,
set name, and collector number exactly as printed (e.g. "4/102" -> "4", "LOB-001", "OP01-120"). For sports cards use the
player name as name and "<year> <brand>" as set. If any field is unreadable, give your best guess, or "" if you cannot tell.
Assess centering, corners, edges and surface from what is visible and give an estimated PSA-style grade from 1 to 10
(integers or .5 steps). Put the reasons in conditionNotes in one or two short sentences. If the card is already in a
graded slab, report grader, grade and cert number in alreadyGraded, otherwise null. If the image is not a trading card,
set isTradingCard to false.`;

export class ScanUnavailableError extends Error {}

export async function identifyCard(apiKey: string, image: { data: string; mediaType: ImageMedia }): Promise<ScanResult> {
  const client = new Anthropic({ apiKey });
  const res = await client.messages.parse({
    model: SCAN_MODEL,
    max_tokens: 4000,
    output_config: { effort: "low", format: zodOutputFormat(ScanResult) },
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } },
        { type: "text", text: PROMPT },
      ],
    }],
  });
  if (res.stop_reason === "refusal") throw new ScanUnavailableError("model declined to analyze this image");
  if (!res.parsed_output) throw new ScanUnavailableError("model returned no structured result");
  return res.parsed_output;
}

// ---- fuzzy matching against the catalog ----
const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const tokens = (s: string) => new Set(norm(s).split(" ").filter(Boolean));

function dice(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return (2 * inter) / (a.size + b.size);
}
const normNum = (s: string) => norm(s.split("/")[0]).replace(/\s/g, "").replace(/^0+(?=\d)/, "");

export function matchCatalog(r: Pick<ScanResult, "name" | "set" | "number" | "game">, cards: Card[], limit = 5) {
  const qName = tokens(r.name), qSet = tokens(r.set), qNum = normNum(r.number);
  const scored = cards.map((c) => {
    let s = 0.6 * dice(qName, tokens(c.name.replace(/\(.*?\)/g, ""))) + 0.1 * dice(qName, tokens(c.name));
    s += 0.15 * dice(qSet, tokens(c.set));
    if (qNum && normNum(c.number) === qNum) s += 0.2;
    if (r.game !== "unknown" && r.game !== c.game) s *= 0.5;
    return { card: c, score: Math.min(1, s) };
  }).filter((x) => x.score > 0.25).sort((a, b) => b.score - a.score).slice(0, limit);
  return scored.map((x) => ({ cardId: x.card.id, name: x.card.name, set: x.card.set, confidence: Math.round(x.score * 100) / 100, card: x.card }));
}

export function priceFor(card: Card | undefined, grade: number): number | null {
  return card ? valueAt(card.prices, gradeFromNumber(grade)) : null;
}
