import type { Card } from "../types.js";
import { fetchJson, num, sleep, type Adapter } from "./http.js";

// https://optcgapi.com — free One Piece TCG API with TCGplayer market prices.
export interface OptcgCard {
  card_set_id: string; // e.g. "OP01-120"
  card_name: string;
  set_name: string;
  set_id?: string;
  rarity: string;
  card_image?: string;
  card_image_id?: string; // e.g. "OP01-120_p1" for alt arts
  market_price?: number | string | null;
  inventory_price?: number | string | null;
  date_scraped?: string;
}

export function mapOnePiece(c: OptcgCard, now = new Date().toISOString()): Card {
  const localId = c.card_image_id && c.card_image_id !== c.card_set_id ? c.card_image_id : c.card_set_id;
  const raw = num(c.market_price) ?? num(c.inventory_price);
  return {
    id: `onepiece:${localId}`,
    game: "onepiece",
    name: c.card_name,
    set: c.set_name.replace(/^-|-$/g, "").trim(),
    number: c.card_set_id,
    rarity: c.rarity,
    imageUrl: c.card_image ?? "",
    prices: raw ? { raw } : {},
    updatedAt: c.date_scraped ? new Date(c.date_scraped).toISOString() : now,
  };
}

export const onepiece: Adapter = {
  name: "optcgapi",
  async *pages({ delayMs }) {
    // optcgapi has no paging; one call per endpoint (sets, starter decks).
    for (const ep of ["allSetCards", "allSTCards"]) {
      const r = await fetchJson<OptcgCard[]>(`https://optcgapi.com/api/${ep}/`);
      yield r.map((c) => mapOnePiece(c));
      await sleep(delayMs);
    }
  },
};
