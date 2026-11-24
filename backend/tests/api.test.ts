import { describe, it, expect } from "vitest";
import { zeroAddress } from "viem";
import { makeApp } from "./helpers.js";
import { env } from "../src/env.js";
import { nullChain } from "../src/chain.js";
import { DEMO_WALLET } from "../src/seed/samples.js";

const W1 = "0x106342ec570e207afda9fda63125d7a9071127f2";
const W2 = "0x0000000000000000000000000000000000000001";
const TOKEN = "0x1111111111111111111111111111111111111111";
const withEnv = (vars: Record<string, string>) => () => {
  const saved = { ...process.env };
  Object.assign(process.env, vars);
  const e = env();
  process.env = saved;
  return e;
};

describe("health + catalog", () => {
  const { req } = makeApp();
  it("GET /health", async () => {
    const r = await req("/health");
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, cards: expect.any(Number) });
  });
  it("seed has ~60 cards across all games", async () => {
    const b = await (await req("/catalog?limit=100")).json();
    expect(b.total).toBeGreaterThanOrEqual(55);
    expect(new Set(b.items.map((c: any) => c.game))).toEqual(new Set(["pokemon", "magic", "yugioh", "onepiece", "sports"]));
  });
  it("searches by name", async () => {
    const b = await (await req("/catalog?q=charizard")).json();
    expect(b.total).toBeGreaterThanOrEqual(3);
    expect(b.items.every((c: any) => c.name.toLowerCase().includes("charizard"))).toBe(true);
  });
  it("multi-term search + game filter + paging", async () => {
    const b = await (await req("/catalog?q=black%20lotus%20alpha&game=magic")).json();
    expect(b.items.map((c: any) => c.id)).toEqual(["magic:lea-232"]);
    const p = await (await req("/catalog?game=pokemon&limit=5&page=2")).json();
    expect(p.items).toHaveLength(5);
    expect(p.page).toBe(2);
    expect(p.items.every((c: any) => c.game === "pokemon")).toBe(true);
  });
  it("validates query", async () => {
    const r = await req("/catalog?game=chess&limit=1000");
    expect(r.status).toBe(400);
    expect((await r.json()).error.code).toBe("validation_error");
  });
  it("GET /cards/:id and 404", async () => {
    const r = await req("/cards/pokemon:base1-4");
    expect(r.status).toBe(200);
    const c = await r.json();
    expect(c).toMatchObject({ id: "pokemon:base1-4", name: "Charizard", game: "pokemon", prices: { raw: 420, psa9: 2100, psa10: 9800 } });
    expect(c.catalogIds.psa10).toMatch(/^0x[0-9a-f]{64}$/);
    const nf = await req("/cards/pokemon:nope");
    expect(nf.status).toBe(404);
    expect((await nf.json()).error.code).toBe("card_not_found");
  });
  it("GET /cards/:id/history", async () => {
    const b = await (await req("/cards/pokemon:base1-4/history")).json();
    expect(b.points.length).toBeGreaterThanOrEqual(20);
    expect(b.points.at(-1)).toMatchObject({ psa10: 9800 });
  });
});

describe("wants", () => {
  it("adds, dedupes, counts and ranks wants", async () => {
    const { req, json } = makeApp();
    expect((await json("/cards/pokemon:base1-4/want", { wallet: W1 })).status).toBe(201);
    const dup = await json("/cards/pokemon:base1-4/want", { wallet: W1.toUpperCase().replace("0X", "0x") });
    expect(dup.status).toBe(200);
    expect((await dup.json()).added).toBe(false);
    await json("/cards/pokemon:base1-4/want", { wallet: W2 });
    await json("/cards/magic:lea-232/want", { wallet: W2 });
    expect(await (await req("/cards/pokemon:base1-4/wants")).json()).toMatchObject({ wants: 2 });
    expect(await (await req(`/cards/pokemon:base1-4/wants?wallet=${W1}`)).json()).toMatchObject({ wanted: true });
    const top = await (await req("/wants/top")).json();
    expect(top.items[0]).toMatchObject({ cardId: "pokemon:base1-4", wants: 2, card: { name: "Charizard" } });
    expect((await (await req("/wants/top?game=magic")).json()).items.map((i: any) => i.cardId)).toEqual(["magic:lea-232"]);
    await json("/cards/pokemon:base1-4/want", { wallet: W2 }, "DELETE");
    expect(await (await req("/cards/pokemon:base1-4/wants")).json()).toMatchObject({ wants: 1 });
  });
  it("rejects bad wallets and unknown cards", async () => {
    const { json } = makeApp();
    expect((await json("/cards/pokemon:base1-4/want", { wallet: "0x123" })).status).toBe(400);
    expect((await json("/cards/nope/want", { wallet: W1 })).status).toBe(404);
  });
});

describe("config", () => {
  it("cata inactive without CATA_TOKEN", async () => {
    const { req } = makeApp({ env: withEnv({ CATA_TOKEN: "" }) });
    const b = await (await req("/config")).json();
    expect(b).toMatchObject({ chainId: 56, cataToken: null, cataActive: false, feeBps: 20, features: { cata: false, packBattles: false, fractional: false, predictions: false } });
    expect(b.paymentTokens).toEqual(["BNB", "USDT"]);
  });
  it("cata active with CATA_TOKEN", async () => {
    const { req } = makeApp({ env: withEnv({ CATA_TOKEN: TOKEN }) });
    const b = await (await req("/config")).json();
    expect(b).toMatchObject({ cataToken: TOKEN, cataActive: true, cataTokenSource: "env" });
    expect(b.paymentTokens).toContain("CATA");
  });
  it("CataConfig on chain overrides env (zero address = inactive)", async () => {
    const e = withEnv({ CATA_TOKEN: TOKEN, CATA_CONFIG_ADDRESS: "0x2222222222222222222222222222222222222222" });
    const off = makeApp({ env: e, chain: { ...nullChain, cataToken: async () => zeroAddress } });
    expect(await (await off.req("/config")).json()).toMatchObject({ cataToken: null, cataActive: false, cataTokenSource: "chain" });
    const on = makeApp({ env: e, chain: { ...nullChain, cataToken: async () => "0x3333333333333333333333333333333333333333" } });
    expect(await (await on.req("/config")).json()).toMatchObject({ cataActive: true, cataToken: "0x3333333333333333333333333333333333333333" });
  });
});

describe("scan", () => {
  it("returns 503 without ANTHROPIC_API_KEY", async () => {
    const { json } = makeApp({ env: withEnv({ ANTHROPIC_API_KEY: "" }) });
    const r = await json("/scan", { imageBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB" });
    expect(r.status).toBe(503);
    expect((await r.json()).error).toMatchObject({ code: "scan_unavailable", message: expect.stringContaining("ANTHROPIC_API_KEY") });
  });
  it("matches model output against catalog (model stubbed)", async () => {
    const { json } = makeApp({
      env: withEnv({ ANTHROPIC_API_KEY: "test" }),
      identify: async () => ({ isTradingCard: true, game: "pokemon", name: "Charizard", set: "Base Set", number: "4/102",
        conditionNotes: "light whitening", estimatedGrade: 9, alreadyGraded: null }),
    });
    const r = await json("/scan", { imageBase64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB" });
    expect(r.status).toBe(200);
    const b = await r.json();
    expect(b.matches[0]).toMatchObject({ cardId: "pokemon:base1-4", name: "Charizard" });
    expect(b.matches[0].confidence).toBeGreaterThan(0.8);
    expect(b).toMatchObject({ estimatedGrade: 9, priceUsd: 2100 });
  });
});

describe("index, pools, points, sets", () => {
  const { req } = makeApp();
  it("GET /index", async () => {
    const b = await (await req("/index")).json();
    expect(b.index.constituents).toBe(50);
    expect(b.index.points.length).toBeGreaterThan(10);
    expect(b.index.points[0].level).toBe(1000);
    expect(Object.keys(b.games).sort()).toEqual(["magic", "onepiece", "pokemon", "sports", "yugioh"]);
  });
  it("GET /pools + /pools/:id (sample)", async () => {
    const list = await (await req("/pools")).json();
    expect(list.items.length).toBeGreaterThan(0);
    const p = await (await req(`/pools/${list.items[0].id}`)).json();
    expect(p).toMatchObject({ source: "sample", cardsLeft: 64 });
    expect(p.grailsLeft).toBeGreaterThan(0);
    expect(p.expectedValueUsd).toBeGreaterThan(0);
    expect(p.cards[0].card.name).toBeTruthy();
    expect((await req("/pools/nope")).status).toBe(404);
  });
  it("points + set progress (local)", async () => {
    expect(await (await req(`/points/${DEMO_WALLET}`)).json()).toMatchObject({ points: "1250", source: "local" });
    expect((await req("/points/notawallet")).status).toBe(400);
    const sets = await (await req("/sets")).json();
    expect(sets.items[0].cards[0].catalogIds.length).toBe(3);
    const pr = await (await req(`/sets/base-starters/progress/${DEMO_WALLET}`)).json();
    expect(pr).toMatchObject({ owned: 2, total: 3, complete: false });
  });
});

describe("live rips", () => {
  const admin = { "x-admin-token": "s3cret" };
  it("requires admin token; full CRUD", async () => {
    const { req, json } = makeApp({ env: withEnv({ ADMIN_TOKEN: "s3cret" }) });
    const body = { title: "op-09 box", product: "OP-09 Booster Box", game: "onepiece", streamUrl: "https://twitch.tv/cata", startsAt: "2026-12-01T20:00:00.000Z", totalSpots: 24, spotPriceUsd: 12 };
    expect((await json("/live-rips", body)).status).toBe(401);
    const cr = await json("/live-rips", body, "POST", admin);
    expect(cr.status).toBe(201);
    const rip = await cr.json();
    expect(rip).toMatchObject({ spotsLeft: 24, status: "scheduled" });
    const up = await json(`/live-rips/${rip.id}`, { status: "live", spots: [{ index: 3, wallet: W1 }], results: [{ spot: 3, cardId: "onepiece:OP09-119" }] }, "PATCH", admin);
    expect(await up.json()).toMatchObject({ status: "live", spotsTaken: 1, results: [{ spot: 3 }] });
    const got = await (await req(`/live-rips/${rip.id}`)).json();
    expect(got.spots[3].wallet.toLowerCase()).toBe(W1);
    expect((await req("/live-rips")).status).toBe(200);
    expect((await req(`/live-rips/${rip.id}`, { method: "DELETE", headers: admin })).status).toBe(204);
    expect((await req(`/live-rips/${rip.id}`)).status).toBe(404);
  });
  it("503 when ADMIN_TOKEN unset", async () => {
    const { json } = makeApp({ env: withEnv({ ADMIN_TOKEN: "" }) });
    expect((await json("/live-rips", {})).status).toBe(503);
  });
});
