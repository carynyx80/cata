import type { ApiCard } from "./api";

export type Card = {
  id: string; name: string; set: string; grade: string; grader: string; cert: string;
  value: number; hue: [string, string]; glyph: "bolt" | "moon" | "wave" | "ball" | "star" | "flame";
  digital?: boolean;
};

export const cards: Card[] = [
  { id: "1", name: "charizard holo", set: "base set 1999", grade: "9", grader: "psa", cert: "48213907", value: 4200, hue: ["#F6A15B", "#E2487F"], glyph: "flame" },
  { id: "2", name: "umbreon vmax alt art", set: "evolving skies", grade: "10", grader: "psa", cert: "71930244", value: 1650, hue: ["#2B1A22", "#6B4BA8"], glyph: "moon" },
  { id: "3", name: "monkey.d.luffy leader", set: "romance dawn op-01", grade: "10", grader: "bgs", cert: "00921837", value: 310, hue: ["#E2487F", "#F7D26A"], glyph: "star" },
  { id: "4", name: "wembanyama prizm rc", set: "2023 panini prizm", grade: "10", grader: "psa", cert: "88120476", value: 890, hue: ["#3D7BD9", "#9AD3E8"], glyph: "ball" },
  { id: "5", name: "pikachu illustrator promo", set: "corocoro 1998", grade: "7", grader: "psa", cert: "10293847", value: 9800, hue: ["#F7D26A", "#F6A15B"], glyph: "bolt" },
  { id: "6", name: "blue-eyes white dragon", set: "lob 1st edition", grade: "8", grader: "psa", cert: "56473829", value: 2100, hue: ["#9AD3E8", "#F4C3D3"], glyph: "wave" },
  { id: "7", name: "black lotus", set: "unlimited", grade: "6", grader: "bgs", cert: "33219874", value: 7400, hue: ["#2B1A22", "#C2336A"], glyph: "star" },
  { id: "8", name: "lugia neo genesis", set: "neo genesis 1st ed", grade: "9", grader: "cgc", cert: "41029384", value: 1280, hue: ["#C9D6F2", "#F4C3D3"], glyph: "wave", digital: true },
];

export const fmt = (n: number) => "$" + n.toLocaleString("en-US");

export const games = ["pokémon", "magic", "yu-gi-oh", "one piece", "sports"] as const;
export type Game = (typeof games)[number];

export type CatalogCard = Card & { game: Game; raw: number; psa9: number; psa10: number; wants: number; inVault: boolean; history: number[]; apiId?: string };

const meta: Record<string, { game: Game; raw: number; psa9: number; psa10: number; wants: number; inVault: boolean }> = {
  "1": { game: "pokémon", raw: 520, psa9: 4200, psa10: 21500, wants: 1284, inVault: true },
  "2": { game: "pokémon", raw: 610, psa9: 980, psa10: 1650, wants: 902, inVault: true },
  "3": { game: "one piece", raw: 45, psa9: 120, psa10: 310, wants: 211, inVault: false },
  "4": { game: "sports", raw: 140, psa9: 360, psa10: 890, wants: 640, inVault: true },
  "5": { game: "pokémon", raw: 3100, psa9: 48000, psa10: 210000, wants: 3022, inVault: false },
  "6": { game: "yu-gi-oh", raw: 380, psa9: 4100, psa10: 9900, wants: 455, inVault: false },
  "7": { game: "magic", raw: 3900, psa9: 26000, psa10: 61000, wants: 1720, inVault: true },
  "8": { game: "pokémon", raw: 290, psa9: 1280, psa10: 5400, wants: 388, inVault: false },
};

function series(seed: number, base: number) {
  const out: number[] = [];
  let v = base * 0.78;
  for (let i = 0; i < 12; i++) {
    const r = Math.sin(seed * 9.1 + i * 1.7) * 0.07 + 0.025;
    v = Math.max(base * 0.4, v * (1 + r));
    out.push(Math.round(v));
  }
  out[11] = base;
  return out;
}

export const catalog: CatalogCard[] = cards.map((c, i) => ({ ...c, ...meta[c.id], history: series(i + 1, c.value) }));
export const getCard = (id: string) => catalog.find((c) => c.id === id);
export const months = ["dec", "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov"];

// ---- backend catalog → UI card ----

const gameLabel: Record<ApiCard["game"], Game> = { pokemon: "pokémon", magic: "magic", yugioh: "yu-gi-oh", onepiece: "one piece", sports: "sports" };
export const gameKey = (g: Game) => (Object.keys(gameLabel) as ApiCard["game"][]).find((k) => gameLabel[k] === g)!;
const palette: [string, string][] = [["#F6A15B", "#E2487F"], ["#2B1A22", "#6B4BA8"], ["#E2487F", "#F7D26A"], ["#3D7BD9", "#9AD3E8"], ["#F7D26A", "#F6A15B"], ["#9AD3E8", "#F4C3D3"], ["#2B1A22", "#C2336A"], ["#C9D6F2", "#F4C3D3"]];
const glyphFor: Record<ApiCard["game"], Card["glyph"]> = { pokemon: "bolt", magic: "star", yugioh: "wave", onepiece: "flame", sports: "ball" };

/** Map a backend card to the shape the existing tiles and detail page render. `apiId` marks it as live. */
export function fromApi(a: ApiCard, history: number[] = []): CatalogCard & { apiId: string } {
  let h = 0;
  for (const ch of a.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const raw = Math.round(a.prices.raw ?? 0), psa9 = Math.round(a.prices.psa9 ?? 0), psa10 = Math.round(a.prices.psa10 ?? 0);
  const value = psa10 || psa9 || raw;
  return {
    id: encodeURIComponent(a.id), apiId: a.id, name: a.name.toLowerCase(), set: `${a.set}${a.number ? ` #${a.number}` : ""}`.toLowerCase(),
    grade: psa10 ? "10" : psa9 ? "9" : "raw", grader: "psa", cert: "index", value, hue: palette[h % palette.length], glyph: glyphFor[a.game] ?? "star",
    game: gameLabel[a.game] ?? "pokémon", raw, psa9, psa10, wants: a.wants ?? 0, inVault: false, history: history.length >= 2 ? history : [value, value],
  };
}
