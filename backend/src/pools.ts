import { formatUnits, type Hex } from "viem";
import type { Repo } from "./db.js";
import type { ChainReader } from "./chain.js";
import { catalogId } from "./catalogId.js";
import { GRADES, valueAt } from "./pricing.js";
import { SAMPLE_POOLS, type PoolDef } from "./seed/samples.js";
import type { Card, Grade } from "./types.js";

export interface PoolView {
  id: string;
  name: string;
  game: string;
  priceUsd: number | null;
  price?: { raw: string; payToken: string };
  active: boolean;
  source: "chain" | "sample";
  cardsLeft: number;
  grailsLeft: number;
  grailThresholdUsd: number;
  totalValueUsd: number;
  expectedValueUsd: number;
  evRatio: number | null; // EV / price
  cards: { cardId: string; catalogId: Hex; grade: Grade; remaining: number; valueUsd: number | null; odds: number; isGrail: boolean; card: Card | null }[];
}

/** Map catalogId -> {cardId, grade} across the whole catalog. */
export function reverseCatalogIds(repo: Repo): Map<string, { cardId: string; grade: Grade }> {
  const m = new Map<string, { cardId: string; grade: Grade }>();
  for (const c of repo.allCards()) for (const g of GRADES) m.set(catalogId(c.id, g), { cardId: c.id, grade: g });
  return m;
}

function enrich(repo: Repo, def: Omit<PoolDef, "cards"> & { cards: { cardId: string; grade: Grade; count: number; catalogId?: Hex }[] },
  extra: Partial<PoolView> & { source: PoolView["source"]; active: boolean }): PoolView {
  const cards = repo.getCards(def.cards.map((c) => c.cardId));
  const left = def.cards.reduce((n, c) => n + c.count, 0);
  let total = 0, grails = 0;
  const rows = def.cards.filter((c) => c.count > 0).map((c) => {
    const card = cards.get(c.cardId) ?? null;
    const v = card ? valueAt(card.prices, c.grade) : null;
    total += (v ?? 0) * c.count;
    const isGrail = (v ?? 0) >= def.grailThresholdUsd;
    if (isGrail) grails += c.count;
    return { cardId: c.cardId, catalogId: c.catalogId ?? catalogId(c.cardId, c.grade), grade: c.grade, remaining: c.count,
      valueUsd: v, odds: left ? c.count / left : 0, isGrail, card };
  }).sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));
  const ev = left ? Math.round((total / left) * 100) / 100 : 0;
  return {
    id: def.id, name: def.name, game: def.game, priceUsd: def.priceUsd, ...extra,
    cardsLeft: left, grailsLeft: grails, grailThresholdUsd: def.grailThresholdUsd,
    totalValueUsd: Math.round(total * 100) / 100, expectedValueUsd: ev,
    evRatio: def.priceUsd ? Math.round((ev / def.priceUsd) * 1000) / 1000 : null, cards: rows,
  };
}

const USDT = "0x55d398326f99059ff775485246999027b3197955";

export async function listPools(repo: Repo, chain: ChainReader): Promise<PoolView[]> {
  let onchain = null;
  try { onchain = await chain.pools(); } catch (e) { console.warn("pool read failed, serving samples:", (e as Error).message); }
  if (!onchain) return SAMPLE_POOLS.map((p) => enrich(repo, p, { source: "sample", active: true }));
  const rev = reverseCatalogIds(repo);
  return onchain.map((p) => {
    const cards = p.contents.map((c) => {
      const k = rev.get(c.catalogId);
      return { cardId: k?.cardId ?? `unknown:${c.catalogId}`, grade: k?.grade ?? ("raw" as Grade), count: c.remaining, catalogId: c.catalogId };
    });
    const isUsdt = p.payToken.toLowerCase() === USDT;
    return enrich(repo, { id: String(p.id), name: p.name, game: "mixed", priceUsd: isUsdt ? Number(formatUnits(p.price, 18)) : 0, grailThresholdUsd: 1000, cards },
      { source: "chain", active: p.active, price: { raw: p.price.toString(), payToken: p.payToken }, ...(isUsdt ? {} : { priceUsd: null }) });
  });
}
