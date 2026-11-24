import { z } from "zod";
import type { Card } from "../types.js";

// Sports cards have no free catalog API: entries come from user submissions and Cata's own sales.
export const sportsSubmissionSchema = z.object({
  year: z.number().int().min(1860).max(2100),
  brand: z.string().min(1).max(80), // "Topps Chrome"
  number: z.string().min(1).max(20),
  player: z.string().min(1).max(80),
  variant: z.string().max(60).optional(),
  rarity: z.string().max(40).optional(),
  imageUrl: z.string().url().optional(),
  grade: z.enum(["raw", "psa9", "psa10"]).optional(),
  priceUsd: z.number().positive().max(1e9).optional(),
  soldAt: z.string().datetime().optional(),
});
export type SportsSubmission = z.infer<typeof sportsSubmissionSchema>;

export interface CataSale {
  cardId: string; // already a sports:* id
  grade: "raw" | "psa9" | "psa10";
  priceUsd: number;
  soldAt: string;
}

const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-");

export function sportsId(s: Pick<SportsSubmission, "year" | "brand" | "number">) {
  return `sports:${s.year}-${slug(s.brand)}-${slug(s.number)}`;
}

export function mapSportsSubmission(s: SportsSubmission, now = new Date().toISOString()): Card {
  const set = `${s.year} ${s.brand}`;
  return {
    id: sportsId(s),
    game: "sports",
    name: s.variant ? `${s.player} (${s.variant})` : s.player,
    set,
    number: s.number,
    rarity: s.rarity ?? "Base",
    imageUrl: s.imageUrl ?? "",
    prices: s.priceUsd ? { [s.grade ?? "raw"]: s.priceUsd } : {},
    updatedAt: s.soldAt ?? now,
  };
}

/** Apply Cata sales: latest sale per (card, grade) becomes the price. */
export function applySales(cards: Card[], sales: CataSale[]): Card[] {
  const byId = new Map(cards.map((c) => [c.id, { ...c, prices: { ...c.prices } }]));
  for (const s of [...sales].sort((a, b) => a.soldAt.localeCompare(b.soldAt))) {
    const c = byId.get(s.cardId);
    if (!c) continue;
    c.prices[s.grade] = s.priceUsd;
    c.updatedAt = s.soldAt;
  }
  return [...byId.values()];
}
