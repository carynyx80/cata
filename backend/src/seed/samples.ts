import type { Grade } from "../types.js";
import type { LiveRip } from "../db.js";

export interface PoolDef {
  id: string;
  name: string;
  game: string;
  priceUsd: number;
  grailThresholdUsd: number;
  cards: { cardId: string; grade: Grade; count: number }[];
}

/** Sample pools served when PACK_MACHINE_ADDRESS is not configured. Labeled sample: true. */
export const SAMPLE_POOLS: PoolDef[] = [
  {
    id: "vintage-pokemon", name: "vintage pokémon glass pack", game: "pokemon", priceUsd: 250, grailThresholdUsd: 2000,
    cards: [
      { cardId: "pokemon:base1-4", grade: "psa9", count: 1 },
      { cardId: "pokemon:neo1-9", grade: "psa9", count: 1 },
      { cardId: "pokemon:base1-2", grade: "psa9", count: 2 },
      { cardId: "pokemon:base1-15", grade: "psa9", count: 2 },
      { cardId: "pokemon:base1-10", grade: "psa9", count: 4 },
      { cardId: "pokemon:base3-5", grade: "psa9", count: 4 },
      { cardId: "pokemon:base1-58", grade: "psa9", count: 20 },
      { cardId: "pokemon:base1-58", grade: "raw", count: 30 },
    ],
  },
  {
    id: "modern-chase", name: "modern chase pack", game: "pokemon", priceUsd: 120, grailThresholdUsd: 1000,
    cards: [
      { cardId: "pokemon:swsh7-215", grade: "psa10", count: 1 },
      { cardId: "pokemon:sv8pt5-161", grade: "psa10", count: 1 },
      { cardId: "pokemon:sv8-238", grade: "psa10", count: 2 },
      { cardId: "pokemon:swsh7-218", grade: "psa10", count: 3 },
      { cardId: "pokemon:sv3pt5-199", grade: "psa10", count: 6 },
      { cardId: "pokemon:sv4pt5-234", grade: "psa10", count: 8 },
      { cardId: "pokemon:sv3pt5-205", grade: "psa10", count: 30 },
      { cardId: "pokemon:swsh12pt5gg-GG44", grade: "psa9", count: 40 },
    ],
  },
  {
    id: "grand-line", name: "grand line pack", game: "onepiece", priceUsd: 150, grailThresholdUsd: 1500,
    cards: [
      { cardId: "onepiece:OP05-119", grade: "psa10", count: 1 },
      { cardId: "onepiece:OP09-119", grade: "psa10", count: 1 },
      { cardId: "onepiece:OP06-118", grade: "psa10", count: 2 },
      { cardId: "onepiece:OP01-120", grade: "psa10", count: 6 },
      { cardId: "onepiece:OP02-013", grade: "psa10", count: 8 },
      { cardId: "onepiece:OP07-051", grade: "psa10", count: 12 },
      { cardId: "onepiece:OP01-024", grade: "psa9", count: 25 },
      { cardId: "onepiece:ST01-012", grade: "psa10", count: 40 },
    ],
  },
];

export interface SetDef {
  id: string;
  name: string;
  game: string;
  description: string;
  rewardPoints: number;
  cards: { cardId: string; grade?: Grade }[]; // grade omitted = any grade counts
}

export const SETS: SetDef[] = [
  { id: "base-starters", name: "base set starters", game: "pokemon", rewardPoints: 5000,
    description: "charizard, blastoise and venusaur from base set — any grade.",
    cards: [{ cardId: "pokemon:base1-4" }, { cardId: "pokemon:base1-2" }, { cardId: "pokemon:base1-15" }] },
  { id: "eeveelution-alts", name: "eeveelution alts", game: "pokemon", rewardPoints: 3000,
    description: "evolving skies + prismatic alts, psa 10.",
    cards: [{ cardId: "pokemon:swsh7-215", grade: "psa10" }, { cardId: "pokemon:swsh7-212", grade: "psa10" }, { cardId: "pokemon:sv8pt5-161", grade: "psa10" }] },
  { id: "kaiba-trinity", name: "kaiba's trinity", game: "yugioh", rewardPoints: 2500,
    description: "lob blue-eyes, dark magician, red-eyes and exodia.",
    cards: [{ cardId: "yugioh:LOB-001" }, { cardId: "yugioh:LOB-005" }, { cardId: "yugioh:LOB-070" }, { cardId: "yugioh:LOB-124" }] },
  { id: "manga-luffy", name: "manga straw hats", game: "onepiece", rewardPoints: 4000,
    description: "manga rare luffy x2 and zoro.",
    cards: [{ cardId: "onepiece:OP05-119" }, { cardId: "onepiece:OP09-119" }, { cardId: "onepiece:OP06-118" }] },
  { id: "power-nine-taste", name: "a taste of power", game: "magic", rewardPoints: 10000,
    description: "alpha black lotus, mox sapphire, time walk.",
    cards: [{ cardId: "magic:lea-232" }, { cardId: "magic:lea-265" }, { cardId: "magic:lea-83" }] },
];

export const SAMPLE_RIPS: LiveRip[] = [
  {
    id: "rip-evs-booster-box", title: "evolving skies booster box rip", product: "Evolving Skies Booster Box (36 packs)", game: "pokemon",
    streamUrl: "https://www.youtube.com/@cata/live", startsAt: "2026-12-05T01:00:00.000Z", status: "scheduled",
    totalSpots: 36, spotPriceUsd: 45,
    spots: Array.from({ length: 36 }, (_, i) => ({ index: i, wallet: null })), results: [],
    onchainId: null, createdAt: "2026-11-20T00:00:00.000Z", updatedAt: "2026-11-20T00:00:00.000Z",
  },
];

/** Demo wallet so /points and /sets/:id/progress return something offline. */
export const DEMO_WALLET = "0x000000000000000000000000000000000000c47a";
export const DEMO_HOLDINGS: { cardId: string; grade: Grade }[] = [
  { cardId: "pokemon:base1-4", grade: "psa9" },
  { cardId: "pokemon:base1-2", grade: "psa10" },
  { cardId: "yugioh:LOB-001", grade: "psa9" },
];
