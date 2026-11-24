import type { Card } from "../types.js";
import { fetchJson, num, sleep, type Adapter } from "./http.js";

// https://docs.pokemontcg.io  (v2). TCGplayer market prices come in card.tcgplayer.prices.
export interface PtcgCard {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  set: { id: string; name: string };
  images?: { small?: string; large?: string };
  tcgplayer?: { updatedAt?: string; prices?: Record<string, { market?: number | null; mid?: number | null }> };
}

const PRICE_PREF = ["holofoil", "1stEditionHolofoil", "unlimitedHolofoil", "reverseHolofoil", "normal", "1stEdition", "unlimited"];

export function mapPokemon(c: PtcgCard, now = new Date().toISOString()): Card {
  const prices = c.tcgplayer?.prices ?? {};
  const key = PRICE_PREF.find((k) => prices[k]) ?? Object.keys(prices)[0];
  const p = key ? prices[key] : undefined;
  const raw = num(p?.market) ?? num(p?.mid);
  const updated = c.tcgplayer?.updatedAt ? new Date(c.tcgplayer.updatedAt.replace(/\//g, "-") + "T00:00:00Z").toISOString() : now;
  return {
    id: `pokemon:${c.id}`,
    game: "pokemon",
    name: c.name,
    set: c.set.name,
    number: c.number,
    rarity: c.rarity ?? "Unknown",
    imageUrl: c.images?.large ?? c.images?.small ?? "",
    prices: raw ? { raw } : {},
    updatedAt: updated,
  };
}

export const pokemonTcg: Adapter = {
  name: "pokemontcg",
  async *pages({ maxPages, delayMs }) {
    const headers: Record<string, string> = process.env.POKEMONTCG_API_KEY ? { "X-Api-Key": process.env.POKEMONTCG_API_KEY } : {};
    for (let page = 1; page <= maxPages; page++) {
      const r = await fetchJson<{ data: PtcgCard[]; totalCount: number; pageSize: number }>(
        `https://api.pokemontcg.io/v2/cards?page=${page}&pageSize=250&orderBy=-set.releaseDate`, { headers });
      yield r.data.map((c) => mapPokemon(c));
      if (page * r.pageSize >= r.totalCount) return;
      await sleep(delayMs);
    }
  },
};
