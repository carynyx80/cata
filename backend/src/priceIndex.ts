import type { Repo } from "./db.js";
import { GAMES, type Card, type Game } from "./types.js";
import { refValue } from "./pricing.js";

export interface IndexSeries {
  name: string;
  constituents: number;
  base: number;
  latest: { t: string; value: number; level: number } | null;
  change30dPct: number | null;
  points: { t: string; value: number; level: number }[];
}

const ref = (p: { raw?: number; psa9?: number; psa10?: number }) => p.psa10 ?? p.psa9 ?? p.raw;

/** Basket value over time; each card carries its last known price forward. Level is normalized to `base` at first point. */
export function computeSeries(repo: Repo, name: string, basket: Card[], dates: string[], base = 1000): IndexSeries {
  const histories = basket.map((c) => repo.history(c.id));
  const idx = histories.map(() => 0);
  const last: (number | undefined)[] = histories.map(() => undefined);
  const raw: { t: string; value: number }[] = [];
  for (const t of dates) {
    let total = 0;
    histories.forEach((h, i) => {
      while (idx[i] < h.length && h[idx[i]].t <= t) { last[i] = ref(h[idx[i]]) ?? last[i]; idx[i]++; }
      total += last[i] ?? 0;
    });
    if (total > 0) raw.push({ t, value: Math.round(total * 100) / 100 });
  }
  const first = raw[0]?.value ?? 0;
  const points = raw.map((p) => ({ ...p, level: first ? Math.round((p.value / first) * base * 100) / 100 : base }));
  const latest = points.at(-1) ?? null;
  let change30dPct: number | null = null;
  if (latest) {
    const cutoff = new Date(new Date(latest.t).getTime() - 30 * 86400000).toISOString().slice(0, 10);
    const prior = [...points].reverse().find((p) => p.t <= cutoff);
    if (prior) change30dPct = Math.round(((latest.value - prior.value) / prior.value) * 10000) / 100;
  }
  return { name, constituents: basket.length, base, latest, change30dPct, points };
}

export function cataPriceIndex(repo: Repo, opts: { top?: number; perGame?: number } = {}) {
  const top = opts.top ?? 50;
  const perGame = opts.perGame ?? 20;
  const all = repo.allCards();
  const ranked = (cards: Card[], n: number) => [...cards].filter((c) => refValue(c.prices) > 0)
    .sort((a, b) => refValue(b.prices) - refValue(a.prices)).slice(0, n);
  const dates = repo.historyDates();
  const basket = ranked(all, top);
  const games: Partial<Record<Game, IndexSeries>> = {};
  for (const g of GAMES) {
    const b = ranked(all.filter((c) => c.game === g), perGame);
    if (b.length) games[g] = computeSeries(repo, `cata ${g} index`, b, dates);
  }
  return {
    index: computeSeries(repo, "cata price index", basket, dates),
    basket: basket.map((c) => ({ cardId: c.id, name: c.name, game: c.game, valueUsd: refValue(c.prices) })),
    games,
    methodology: `Top ${top} cards by top-grade USD value (PSA 10, else PSA 9, else raw); sum of basket value per date with last price carried forward; level normalized to 1000 at first point. Per-game sub-indices use the top ${perGame} cards of each game.`,
  };
}
