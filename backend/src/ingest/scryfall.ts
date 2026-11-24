import type { Card } from "../types.js";
import { fetchJson, num, sleep, type Adapter } from "./http.js";

// https://scryfall.com/docs/api — asks for 50–100ms between requests. Prices in USD as strings.
export interface ScryfallCard {
  id: string;
  name: string;
  set: string;
  set_name: string;
  collector_number: string;
  rarity: string;
  image_uris?: { normal?: string; large?: string };
  card_faces?: { image_uris?: { normal?: string; large?: string } }[];
  prices?: { usd?: string | null; usd_foil?: string | null };
}

export function mapScryfall(c: ScryfallCard, now = new Date().toISOString()): Card {
  const raw = num(c.prices?.usd) ?? num(c.prices?.usd_foil);
  const img = c.image_uris ?? c.card_faces?.[0]?.image_uris;
  return {
    id: `magic:${c.set}-${c.collector_number}`,
    game: "magic",
    name: c.name,
    set: c.set_name,
    number: c.collector_number,
    rarity: c.rarity,
    imageUrl: img?.large ?? img?.normal ?? "",
    prices: raw ? { raw } : {},
    updatedAt: now,
  };
}

export const scryfall: Adapter = {
  name: "scryfall",
  async *pages({ maxPages, delayMs }) {
    // Search endpoint paged at 175; default query targets cards with a price (bulk data is an alternative for full sync).
    let url: string | null = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(process.env.SCRYFALL_QUERY ?? "usd>=5")}&order=usd&dir=desc`;
    for (let page = 1; url && page <= maxPages; page++) {
      const r: { data: ScryfallCard[]; has_more: boolean; next_page?: string } = await fetchJson(url);
      yield r.data.map((c) => mapScryfall(c));
      url = r.has_more ? r.next_page ?? null : null;
      await sleep(Math.max(delayMs, 100));
    }
  },
};
