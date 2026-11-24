import type { Card } from "../types.js";
import { fetchJson, num, sleep, type Adapter } from "./http.js";

// https://ygoprodeck.com/api-guide/ — 20 req/s limit. Each card has card_sets[] (one printing each) and card_prices[].
export interface YgoCard {
  id: number;
  name: string;
  card_sets?: { set_name: string; set_code: string; set_rarity: string; set_price?: string }[];
  card_images?: { image_url: string; image_url_small?: string }[];
  card_prices?: { tcgplayer_price?: string; cardmarket_price?: string; ebay_price?: string }[];
}

/** One unified Card per printing (set_code); falls back to a single generic card if no sets. */
export function mapYgo(c: YgoCard, now = new Date().toISOString()): Card[] {
  const img = c.card_images?.[0]?.image_url ?? "";
  const fallback = num(c.card_prices?.[0]?.tcgplayer_price);
  if (!c.card_sets?.length) {
    return [{ id: `yugioh:${c.id}`, game: "yugioh", name: c.name, set: "Unknown", number: String(c.id), rarity: "Unknown",
      imageUrl: img, prices: fallback ? { raw: fallback } : {}, updatedAt: now }];
  }
  return c.card_sets.map((s) => {
    const raw = num(s.set_price) ?? fallback;
    return { id: `yugioh:${s.set_code}`, game: "yugioh" as const, name: c.name, set: s.set_name, number: s.set_code,
      rarity: s.set_rarity, imageUrl: img, prices: raw ? { raw } : {}, updatedAt: now };
  });
}

export const ygoprodeck: Adapter = {
  name: "ygoprodeck",
  async *pages({ maxPages, delayMs }) {
    const per = 500;
    for (let page = 0; page < maxPages; page++) {
      const r = await fetchJson<{ data: YgoCard[]; meta?: { next_page?: string } }>(
        `https://db.ygoprodeck.com/api/v7/cardinfo.php?num=${per}&offset=${page * per}`);
      yield r.data.flatMap((c) => mapYgo(c));
      if (!r.meta?.next_page) return;
      await sleep(Math.max(delayMs, 100));
    }
  },
};
