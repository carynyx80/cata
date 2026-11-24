import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { mapPokemon } from "../src/ingest/pokemonTcg.js";
import { mapScryfall } from "../src/ingest/scryfall.js";
import { mapYgo } from "../src/ingest/ygoprodeck.js";
import { mapOnePiece } from "../src/ingest/onepiece.js";
import { applySales, mapSportsSubmission, sportsSubmissionSchema } from "../src/ingest/sports.js";

const fx = (n: string) => JSON.parse(readFileSync(new URL(`./fixtures/${n}`, import.meta.url), "utf8"));
const NOW = "2026-11-24T00:00:00.000Z";

describe("pokemontcg adapter", () => {
  const cards = fx("pokemontcg.json").data.map((c: any) => mapPokemon(c, NOW));
  it("maps id, set, number, image, TCGplayer market price", () => {
    expect(cards[0]).toEqual({ id: "pokemon:base1-4", game: "pokemon", name: "Charizard", set: "Base", number: "4", rarity: "Rare Holo",
      imageUrl: "https://images.pokemontcg.io/base1/4_hires.png", prices: { raw: 431.62 }, updatedAt: "2026-11-20T00:00:00.000Z" });
  });
  it("falls back to mid price, and handles missing prices/rarity", () => {
    expect(cards[1].prices).toEqual({ raw: 120.5 });
    expect(cards[2]).toMatchObject({ prices: {}, rarity: "Unknown", imageUrl: "https://images.pokemontcg.io/base1/100.png", updatedAt: NOW });
  });
});

describe("scryfall adapter", () => {
  const cards = fx("scryfall.json").data.map((c: any) => mapScryfall(c, NOW));
  it("maps USD price strings and set/collector number id", () => {
    expect(cards[0]).toMatchObject({ id: "magic:lea-232", name: "Black Lotus", set: "Limited Edition Alpha", prices: { raw: 38500 } });
    expect(cards[0].imageUrl).toContain("/large/");
  });
  it("uses foil price and first face image for DFCs", () => {
    expect(cards[1]).toMatchObject({ id: "magic:isd-51", prices: { raw: 12.4 }, imageUrl: "https://cards.scryfall.io/normal/front/a.jpg" });
  });
});

describe("ygoprodeck adapter", () => {
  const cards = fx("ygoprodeck.json").data.flatMap((c: any) => mapYgo(c, NOW));
  it("emits one card per printing with set price, falling back to tcgplayer price", () => {
    expect(cards.map((c: any) => c.id)).toEqual(["yugioh:LOB-001", "yugioh:SDK-001", "yugioh:12345678"]);
    expect(cards[0]).toMatchObject({ name: "Blue-Eyes White Dragon", set: "Legend of Blue Eyes White Dragon", rarity: "Ultra Rare", prices: { raw: 162.35 } });
    expect(cards[1].prices).toEqual({ raw: 1.98 });
    expect(cards[2].prices).toEqual({});
  });
});

describe("optcgapi adapter", () => {
  const cards = fx("optcgapi.json").map((c: any) => mapOnePiece(c, NOW));
  it("uses image id for alt arts and market price", () => {
    expect(cards[0]).toMatchObject({ id: "onepiece:OP01-120_p1", number: "OP01-120", rarity: "SEC", prices: { raw: 312.45 }, updatedAt: "2026-11-19T00:00:00.000Z" });
  });
  it("cleans set names and falls back to inventory price", () => {
    expect(cards[1]).toMatchObject({ id: "onepiece:ST01-001", set: "Starter Deck 1: Straw Hat Crew", prices: { raw: 0.35 } });
  });
});

describe("sports adapter", () => {
  const f = fx("sports.json");
  const cards = f.submissions.map((s: any) => mapSportsSubmission(sportsSubmissionSchema.parse(s), NOW));
  it("maps user submissions", () => {
    expect(cards[0]).toMatchObject({ id: "sports:1986-fleer-57", name: "Michael Jordan", set: "1986 Fleer", prices: { psa9: 9400 } });
    expect(cards[1]).toMatchObject({ id: "sports:2018-panini-prizm-280", name: "Luka Doncic (Silver)", prices: {} });
  });
  it("applies latest Cata sales per grade and ignores unknown cards", () => {
    const out = applySales(cards, f.sales);
    expect(out[0].prices).toEqual({ psa9: 9800, psa10: 158000 });
    expect(out[0].updatedAt).toBe("2026-11-15T00:00:00.000Z");
    expect(out).toHaveLength(2);
  });
  it("rejects bad submissions", () => {
    expect(sportsSubmissionSchema.safeParse({ year: 1700, brand: "", number: "1", player: "x" }).success).toBe(false);
  });
});
