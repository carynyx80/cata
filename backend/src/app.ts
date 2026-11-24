import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { getAddress, hexToString, isAddress, zeroAddress, type Address, type Hex } from "viem";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import type { Repo, LiveRip } from "./db.js";
import { env as readEnv, type Env } from "./env.js";
import { nullChain, TokenNotFoundError, type ChainReader } from "./chain.js";
import { catalogId } from "./catalogId.js";
import { cataPriceIndex } from "./priceIndex.js";
import { listPools, reverseCatalogIds } from "./pools.js";
import { SETS } from "./seed/samples.js";
import { identifyCard, matchCatalog, priceFor, ScanUnavailableError, SCAN_MODEL, type ImageMedia } from "./scan.js";
import { mapSportsSubmission, sportsSubmissionSchema } from "./ingest/sports.js";
import { GAMES, type Grade } from "./types.js";
import { refValue } from "./pricing.js";

export interface AppDeps {
  repo: Repo;
  env?: () => Env;
  chain?: ChainReader;
  identify?: typeof identifyCard; // injectable for tests
}

class ApiError extends HTTPException {
  constructor(status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 502 | 503, public code: string, message: string, public details?: unknown) {
    super(status, { message });
  }
}

const wallet = z.string().refine((v) => isAddress(v, { strict: false }), "invalid wallet address").transform((v) => getAddress(v.toLowerCase()) as Address);
const gameQ = z.enum(GAMES).optional();

function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) throw new ApiError(400, "validation_error", "invalid request", z.flattenError(r.error));
  return r.data;
}

async function jsonBody(c: Context): Promise<unknown> {
  try { return await c.req.json(); } catch { throw new ApiError(400, "invalid_json", "request body must be JSON"); }
}

export function createApp(deps: AppDeps) {
  const { repo } = deps;
  const getEnv = deps.env ?? readEnv;
  const chain = deps.chain ?? nullChain;
  const identify = deps.identify ?? identifyCard;
  const app = new Hono();

  app.use("*", async (c, next) => {
    const origins = getEnv().corsOrigin.split(",").map((s) => s.trim());
    return cors({
      origin: origins.includes("*") ? "*" : origins,
      allowHeaders: ["Content-Type", "Authorization", "X-Admin-Token"],
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      maxAge: 600,
    })(c, next);
  });

  app.onError((err, c) => {
    if (err instanceof ApiError) return c.json({ error: { code: err.code, message: err.message, details: err.details } }, err.status);
    if (err instanceof HTTPException) return c.json({ error: { code: "http_error", message: err.message } }, err.status);
    console.error(err);
    return c.json({ error: { code: "internal_error", message: "internal server error" } }, 500);
  });
  app.notFound((c) => c.json({ error: { code: "not_found", message: `no route ${c.req.method} ${c.req.path}` } }, 404));

  const requireAdmin = (c: Context) => {
    const token = getEnv().adminToken;
    if (!token) throw new ApiError(503, "admin_disabled", "ADMIN_TOKEN is not configured");
    const got = c.req.header("x-admin-token") ?? c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
    if (got !== token) throw new ApiError(401, "unauthorized", "missing or invalid admin token");
  };
  const mustCard = (id: string) => {
    const card = repo.getCard(id);
    if (!card) throw new ApiError(404, "card_not_found", `no card ${id}`);
    return card;
  };

  // ---- health / config ----
  app.get("/health", (c) => c.json({ ok: true, service: "cata-backend", cards: repo.countCards(), time: new Date().toISOString() }));

  app.get("/config", async (c) => {
    const e = getEnv();
    let cataToken: Address | null = null;
    let source: "chain" | "env" | "chain_error" = "env";
    let feeBps = 20;
    if (e.contracts.cataConfig) {
      try {
        const [t, fee] = await Promise.all([chain.cataToken(), chain.feeBps()]);
        if (fee !== null) feeBps = fee;
        cataToken = t && t !== zeroAddress ? t : null;
        source = "chain";
      } catch (err) {
        console.warn("CataConfig read failed:", (err as Error).message);
        source = "chain_error";
        cataToken = e.cataToken;
      }
    } else {
      cataToken = e.cataToken && e.cataToken !== zeroAddress ? e.cataToken : null;
    }
    return c.json({
      chainId: 56,
      contracts: { ...e.contracts, usdt: "0x55d398326f99059fF775485246999027B3197955", pancakeRouter: "0x10ED43C718714eb63d5aA57B78B54704E256024E" },
      cataToken,
      cataActive: cataToken !== null,
      cataTokenSource: source,
      feeBps,
      sellbackBps: 8500,
      paymentTokens: ["BNB", "USDT", ...(cataToken ? ["CATA"] : [])],
      features: {
        catalog: true, vault: true, glassPacks: true, marketplace: true, redeem: true,
        scan: !!e.anthropicKey, borrow: true, liveRips: true, setRewards: true, giftPacks: true, priceIndex: true,
        cardPayments: false, // "coming soon"
        wants: true, cata: cataToken !== null,
        packBattles: e.features.packBattles, fractional: e.features.fractional, predictions: e.features.predictions,
      },
    });
  });

  // ---- catalog ----
  app.get("/catalog", (c) => {
    const q = parse(z.object({
      q: z.string().max(100).optional(),
      game: gameQ,
      page: z.coerce.number().int().min(1).max(10000).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(24),
    }), c.req.query());
    const { items, total } = repo.search(q);
    return c.json({ items, page: q.page, limit: q.limit, total, pages: Math.ceil(total / q.limit) });
  });

  app.get("/cards/:id", (c) => {
    const card = mustCard(c.req.param("id"));
    return c.json({ ...card, wants: repo.wantCount(card.id),
      catalogIds: Object.fromEntries((["raw", "psa9", "psa10"] as Grade[]).map((g) => [g, catalogId(card.id, g)])) });
  });

  app.get("/cards/:id/history", (c) => {
    const card = mustCard(c.req.param("id"));
    const { days } = parse(z.object({ days: z.coerce.number().int().min(1).max(3650).optional() }), c.req.query());
    const since = days ? new Date(Date.now() - days * 86400000).toISOString().slice(0, 10) : undefined;
    return c.json({ cardId: card.id, currency: "USD", points: repo.history(card.id, since) });
  });

  app.post("/cards/:id/want", async (c) => {
    const card = mustCard(c.req.param("id"));
    const body = parse(z.object({ wallet }), await jsonBody(c));
    const added = repo.addWant(card.id, body.wallet);
    return c.json({ cardId: card.id, wallet: body.wallet, added, wants: repo.wantCount(card.id) }, added ? 201 : 200);
  });

  app.delete("/cards/:id/want", async (c) => {
    const card = mustCard(c.req.param("id"));
    const body = parse(z.object({ wallet }), await jsonBody(c));
    const removed = repo.removeWant(card.id, body.wallet);
    return c.json({ cardId: card.id, wallet: body.wallet, removed, wants: repo.wantCount(card.id) });
  });

  app.get("/cards/:id/wants", (c) => {
    const card = mustCard(c.req.param("id"));
    const { wallet: w } = parse(z.object({ wallet: wallet.optional() }), c.req.query());
    return c.json({ cardId: card.id, wants: repo.wantCount(card.id), ...(w ? { wanted: repo.hasWant(card.id, w) } : {}) });
  });

  app.get("/wants/top", (c) => {
    const q = parse(z.object({ limit: z.coerce.number().int().min(1).max(100).default(20), game: gameQ }), c.req.query());
    const top = repo.topWants(q.limit, q.game);
    const cards = repo.getCards(top.map((t) => t.cardId));
    return c.json({ items: top.map((t) => ({ ...t, card: cards.get(t.cardId) ?? null })) });
  });

  app.post("/sports/submissions", async (c) => {
    const s = parse(sportsSubmissionSchema, await jsonBody(c));
    const card = mapSportsSubmission(s);
    repo.upsertCards([card]);
    return c.json(repo.getCard(card.id), 201);
  });

  // ---- price index ----
  app.get("/index", (c) => {
    const q = parse(z.object({ top: z.coerce.number().int().min(5).max(200).default(50) }), c.req.query());
    return c.json(cataPriceIndex(repo, { top: q.top }));
  });

  // ---- glass packs ----
  app.get("/pools", async (c) => {
    const pools = await listPools(repo, chain);
    return c.json({ items: pools.map(({ cards, ...p }) => ({ ...p, topCards: cards.slice(0, 3).map(({ card, ...r }) => ({ ...r, name: card?.name, imageUrl: card?.imageUrl })) })) });
  });
  app.get("/pools/:id", async (c) => {
    const pool = (await listPools(repo, chain)).find((p) => p.id === c.req.param("id"));
    if (!pool) throw new ApiError(404, "pool_not_found", `no pool ${c.req.param("id")}`);
    return c.json(pool);
  });

  // ---- scan ----
  app.post("/scan", async (c) => {
    const key = getEnv().anthropicKey;
    if (!key) throw new ApiError(503, "scan_unavailable", "AI card scan is not configured on this server (ANTHROPIC_API_KEY is not set)");
    const ALLOWED: ImageMedia[] = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    const MAX = 5 * 1024 * 1024;
    let data: string, mediaType: ImageMedia;
    const ct = c.req.header("content-type") ?? "";
    if (ct.startsWith("multipart/form-data")) {
      const form = await c.req.parseBody();
      const f = form.image ?? form.file;
      if (!(f instanceof File)) throw new ApiError(400, "validation_error", "multipart field 'image' is required");
      if (!ALLOWED.includes(f.type as ImageMedia)) throw new ApiError(415, "unsupported_media", `image must be one of ${ALLOWED.join(", ")}`);
      if (f.size > MAX) throw new ApiError(413, "too_large", "image must be 5MB or smaller");
      data = Buffer.from(await f.arrayBuffer()).toString("base64");
      mediaType = f.type as ImageMedia;
    } else {
      const b = parse(z.object({ imageBase64: z.string().min(16), mediaType: z.enum(ALLOWED as [ImageMedia, ...ImageMedia[]]).optional() }), await jsonBody(c));
      const m = b.imageBase64.match(/^data:(image\/[a-z]+);base64,(.*)$/s);
      data = (m ? m[2] : b.imageBase64).replace(/\s/g, "");
      mediaType = (m?.[1] as ImageMedia) ?? b.mediaType ?? "image/jpeg";
      if (!ALLOWED.includes(mediaType)) throw new ApiError(415, "unsupported_media", `image must be one of ${ALLOWED.join(", ")}`);
      if ((data.length * 3) / 4 > MAX) throw new ApiError(413, "too_large", "image must be 5MB or smaller");
    }
    let r;
    try {
      r = await identify(key, { data, mediaType });
    } catch (err) {
      if (err instanceof ScanUnavailableError) throw new ApiError(502, "scan_failed", err.message);
      console.error("scan error", err);
      throw new ApiError(502, "scan_failed", "card scan model request failed");
    }
    if (!r.isTradingCard) return c.json({ matches: [], estimatedGrade: null, priceUsd: null, detected: r, model: SCAN_MODEL });
    const grade = Math.max(1, Math.min(10, Math.round(r.estimatedGrade * 2) / 2));
    const matches = matchCatalog(r, repo.allCards());
    return c.json({
      matches: matches.map(({ card, ...m }) => ({ ...m, imageUrl: card.imageUrl })),
      estimatedGrade: grade,
      priceUsd: priceFor(matches[0]?.card, grade),
      detected: r,
      model: SCAN_MODEL,
    });
  });

  // ---- points & sets ----
  app.get("/points/:wallet", async (c) => {
    const w = parse(wallet, c.req.param("wallet"));
    try {
      const p = await chain.pointsOf(w);
      if (p !== null) return c.json({ wallet: w, points: p.toString(), source: "chain" });
    } catch (err) { console.warn("points read failed:", (err as Error).message); }
    return c.json({ wallet: w, points: String(repo.getPoints(w)), source: "local" });
  });

  const setView = (s: (typeof SETS)[number]) => ({
    ...s,
    cards: s.cards.map((x) => {
      const card = repo.getCard(x.cardId);
      return { ...x, catalogIds: (x.grade ? [x.grade] : (["raw", "psa9", "psa10"] as Grade[])).map((g) => catalogId(x.cardId, g)),
        name: card?.name ?? null, imageUrl: card?.imageUrl ?? null, valueUsd: card ? refValue(card.prices) : null };
    }),
  });
  app.get("/sets", (c) => c.json({ items: SETS.map(setView) }));
  app.get("/sets/:id", (c) => {
    const s = SETS.find((x) => x.id === c.req.param("id"));
    if (!s) throw new ApiError(404, "set_not_found", `no set ${c.req.param("id")}`);
    return c.json(setView(s));
  });
  app.get("/sets/:id/progress/:wallet", async (c) => {
    const s = SETS.find((x) => x.id === c.req.param("id"));
    if (!s) throw new ApiError(404, "set_not_found", `no set ${c.req.param("id")}`);
    const w = parse(wallet, c.req.param("wallet"));
    let owned: { cardId: string; grade: string }[];
    let source: "chain" | "local" = "local";
    let ids = null;
    try { ids = await chain.ownedCatalogIds(w); } catch (err) { console.warn("vault read failed:", (err as Error).message); }
    if (ids) {
      const rev = reverseCatalogIds(repo);
      owned = ids.map((id) => rev.get(id)).filter((x): x is { cardId: string; grade: Grade } => !!x);
      source = "chain";
    } else owned = repo.holdings(w);
    const cards = s.cards.map((x) => ({ ...x, owned: owned.some((o) => o.cardId === x.cardId && (!x.grade || o.grade === x.grade)) }));
    const have = cards.filter((x) => x.owned).length;
    return c.json({ setId: s.id, wallet: w, source, owned: have, total: cards.length, complete: have === cards.length,
      progress: Math.round((have / cards.length) * 1000) / 1000, rewardPoints: s.rewardPoints, cards });
  });

  // ---- live rips ----
  const ripCreate = z.object({
    title: z.string().min(1).max(120),
    product: z.string().min(1).max(200),
    game: z.enum(GAMES),
    streamUrl: z.string().url(),
    startsAt: z.string().datetime(),
    status: z.enum(["scheduled", "live", "ended", "cancelled"]).default("scheduled"),
    totalSpots: z.number().int().min(1).max(1000),
    spotPriceUsd: z.number().positive().max(1e6),
    onchainId: z.string().max(80).nullable().optional(),
  });
  const ripPatch = ripCreate.partial().extend({
    spots: z.array(z.object({ index: z.number().int().min(0), wallet: wallet.nullable(), txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/).nullable().optional() })).optional(),
    results: z.array(z.object({ spot: z.number().int().min(0), cardId: z.string().min(1), grade: z.string().max(20).optional(), note: z.string().max(200).optional() })).optional(),
  });
  const ripView = (r: LiveRip) => ({ ...r, spotsTaken: r.spots.filter((s) => s.wallet).length, spotsLeft: r.spots.filter((s) => !s.wallet).length });

  app.get("/live-rips", (c) => {
    const q = parse(z.object({ status: z.enum(["scheduled", "live", "ended", "cancelled"]).optional() }), c.req.query());
    return c.json({ items: repo.listRips().filter((r) => !q.status || r.status === q.status).map(({ spots, results, ...r }) => ({
      ...r, spotsTaken: spots.filter((s) => s.wallet).length, spotsLeft: spots.filter((s) => !s.wallet).length, resultsCount: results.length })) });
  });
  app.get("/live-rips/:id", (c) => {
    const r = repo.getRip(c.req.param("id"));
    if (!r) throw new ApiError(404, "rip_not_found", `no live rip ${c.req.param("id")}`);
    return c.json(ripView(r));
  });
  app.post("/live-rips", async (c) => {
    requireAdmin(c);
    const b = parse(ripCreate, await jsonBody(c));
    const now = new Date().toISOString();
    const rip: LiveRip = { ...b, id: `rip-${randomUUID().slice(0, 8)}`, onchainId: b.onchainId ?? null,
      spots: Array.from({ length: b.totalSpots }, (_, i) => ({ index: i, wallet: null })), results: [], createdAt: now, updatedAt: now };
    repo.saveRip(rip);
    return c.json(ripView(rip), 201);
  });
  app.patch("/live-rips/:id", async (c) => {
    requireAdmin(c);
    const r = repo.getRip(c.req.param("id"));
    if (!r) throw new ApiError(404, "rip_not_found", `no live rip ${c.req.param("id")}`);
    const b = parse(ripPatch, await jsonBody(c));
    const { spots, results, ...rest } = b;
    const next: LiveRip = { ...r, ...rest, onchainId: rest.onchainId === undefined ? r.onchainId : rest.onchainId, updatedAt: new Date().toISOString() };
    if (b.totalSpots && b.totalSpots !== r.totalSpots) {
      next.spots = Array.from({ length: b.totalSpots }, (_, i) => r.spots[i] ?? { index: i, wallet: null });
    }
    for (const s of spots ?? []) {
      if (s.index >= next.totalSpots) throw new ApiError(400, "validation_error", `spot ${s.index} out of range`);
      next.spots[s.index] = { index: s.index, wallet: s.wallet, txHash: s.txHash ?? null };
    }
    if (results) next.results = results;
    repo.saveRip(next);
    return c.json(ripView(next));
  });
  app.delete("/live-rips/:id", (c) => {
    requireAdmin(c);
    if (!repo.deleteRip(c.req.param("id"))) throw new ApiError(404, "rip_not_found", `no live rip ${c.req.param("id")}`);
    return c.body(null, 204);
  });

  // ---- NFT metadata (CataVault baseURI points here: <base>/metadata/<tokenId>) ----
  const SITE = "https://catapacks.xyz";
  const GAME_LABEL: Record<string, string> = { pokemon: "Pokemon", magic: "Magic: The Gathering", yugioh: "Yu-Gi-Oh!", onepiece: "One Piece", sports: "Sports" };

  app.get("/metadata/contract", (c) => {
    c.header("Cache-Control", "public, max-age=3600");
    return c.json({
      name: "Cata Vault",
      description: "Graded trading cards held in the Cata vault. Each token is one physical slab you can trade, open in glass packs, or redeem for the real card.",
      image: `${SITE}/favicon.ico`,
      external_link: SITE,
    });
  });

  app.get("/metadata/:tokenId", async (c) => {
    const raw = c.req.param("tokenId").replace(/\.json$/, "");
    if (!/^\d{1,78}$/.test(raw)) throw new ApiError(400, "invalid_token_id", "tokenId must be a non-negative integer");
    const tokenId = BigInt(raw);
    let slab;
    try {
      slab = await chain.vaultCard(tokenId);
    } catch (err) {
      if (err instanceof TokenNotFoundError) throw new ApiError(404, "token_not_found", `token ${raw} does not exist`);
      throw new ApiError(502, "chain_error", "failed to read the vault");
    }
    if (!slab) throw new ApiError(404, "vault_not_configured", "CATA_VAULT_ADDRESS is not set");
    const grader = graderName(slab.grader);
    const ref = reverseCatalogIds(repo).get(slab.catalogId.toLowerCase());
    const card = ref ? repo.getCard(ref.cardId) : null;
    const gradeLabel = slab.grade > 0 ? `${grader || "Graded"} ${slab.grade}` : "Raw";
    const attributes: { trait_type: string; value: string | number; display_type?: string }[] = [
      { trait_type: "Grade", value: slab.grade, display_type: "number" },
      { trait_type: "Grader", value: grader || "None" },
      { trait_type: "Cert", value: slab.cert || "None" },
      { trait_type: "Physical", value: slab.physical ? "In vault" : "Redeemed" },
    ];
    if (card) {
      attributes.push({ trait_type: "Game", value: GAME_LABEL[card.game] ?? card.game }, { trait_type: "Set", value: card.set }, { trait_type: "Number", value: card.number });
      if (card.rarity) attributes.push({ trait_type: "Rarity", value: card.rarity });
    }
    c.header("Cache-Control", "public, max-age=300");
    return c.json({
      name: card ? `${card.name} · ${gradeLabel}` : `Cata Slab #${raw}`,
      description: card
        ? `${card.name} (${card.set} #${card.number}), ${gradeLabel}${slab.cert ? `, cert ${slab.cert}` : ""}. ${slab.physical ? "The physical card is held in the Cata vault and can be redeemed." : "This card has been redeemed."}`
        : `Cata vault slab #${raw}, ${gradeLabel}${slab.cert ? `, cert ${slab.cert}` : ""}.`,
      image: card?.imageUrl || `${SITE}/favicon.ico`,
      external_url: `${SITE}/vault`,
      attributes,
      catalogId: slab.catalogId,
      cardId: card?.id ?? null,
    });
  });

  return app;
}

/** bytes16 ASCII (e.g. "PSA" right-padded with zeros) to a string. */
export function graderName(b: Hex): string {
  try { return hexToString(b).replace(/\0+$/g, "").trim(); } catch { return ""; }
}

