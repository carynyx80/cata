export const GAMES = ["pokemon", "magic", "yugioh", "onepiece", "sports"] as const;
export type Game = (typeof GAMES)[number];

export interface Prices {
  raw?: number;
  psa9?: number;
  psa10?: number;
}

export interface Card {
  id: string; // e.g. "pokemon:base1-4"
  game: Game;
  name: string;
  set: string;
  number: string;
  rarity: string;
  imageUrl: string;
  prices: Prices; // USD
  updatedAt: string; // ISO
}

export interface PricePoint {
  t: string; // ISO date
  raw?: number;
  psa9?: number;
  psa10?: number;
}

export type Grade = "raw" | "psa9" | "psa10";
