import { describe, expect, it } from "vitest";
import { stringToHex } from "viem";
import { makeApp } from "./helpers.js";
import { nullChain, TokenNotFoundError, type ChainReader } from "../src/chain.js";
import { catalogId } from "../src/catalogId.js";
import { graderName } from "../src/app.js";
import { env, DEFAULT_CORS_ORIGINS } from "../src/env.js";

const chainWith = (vaultCard: ChainReader["vaultCard"]): ChainReader => ({ ...nullChain, vaultCard });

describe("NFT metadata", () => {
  it("GET /metadata/contract returns collection metadata", async () => {
    const { req } = makeApp();
    const r = await req("/metadata/contract");
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.name).toBe("Cata Vault");
    expect(j.external_link).toBe("https://catapacks.xyz");
  });

  it("404 when the vault is not configured", async () => {
    const { req } = makeApp();
    const r = await req("/metadata/1");
    expect(r.status).toBe(404);
    expect((await r.json()).error.code).toBe("vault_not_configured");
  });

  it("400 on a non-numeric token id", async () => {
    const { req } = makeApp();
    expect((await req("/metadata/abc")).status).toBe(400);
  });

  it("returns ERC-721 JSON for a vault token", async () => {
    const { req, repo } = makeApp({
      chain: chainWith(async (id) => {
        expect(id).toBe(7n);
        const card = repo.allCards()[0];
        return { catalogId: catalogId(card.id, "psa10"), grade: 10, grader: stringToHex("PSA", { size: 16 }), cert: "12345678", physical: true };
      }),
    });
    const card = repo.allCards()[0];
    const r = await req("/metadata/7.json");
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.name).toContain(card.name);
    expect(j.name).toContain("PSA 10");
    expect(j.image).toBe(card.imageUrl);
    expect(j.cardId).toBe(card.id);
    const attr = Object.fromEntries(j.attributes.map((a: any) => [a.trait_type, a.value]));
    expect(attr).toMatchObject({ Grade: 10, Grader: "PSA", Cert: "12345678", Physical: "In vault" });
  });

  it("falls back to a generic name for an unknown catalog id", async () => {
    const { req } = makeApp({
      chain: chainWith(async () => ({ catalogId: `0x${"ab".repeat(32)}`, grade: 9, grader: stringToHex("BGS", { size: 16 }), cert: "", physical: false })),
    });
    const j = await (await req("/metadata/3")).json();
    expect(j.name).toBe("Cata Slab #3");
    expect(j.attributes.find((a: any) => a.trait_type === "Physical").value).toBe("Redeemed");
  });

  it("404 when the token does not exist", async () => {
    const { req } = makeApp({ chain: chainWith(async () => { throw new TokenNotFoundError("9"); }) });
    const r = await req("/metadata/9");
    expect(r.status).toBe(404);
    expect((await r.json()).error.code).toBe("token_not_found");
  });

  it("graderName strips padding", () => {
    expect(graderName(stringToHex("CGC", { size: 16 }))).toBe("CGC");
  });
});

describe("deploy config", () => {
  it("defaults CORS to the site and local dev origins", async () => {
    const prev = process.env.CORS_ORIGIN;
    delete process.env.CORS_ORIGIN;
    try {
      expect(env().corsOrigin).toBe(DEFAULT_CORS_ORIGINS);
      const { req } = makeApp();
      const ok = await req("/health", { headers: { origin: "https://www.catapacks.xyz" } });
      expect(ok.headers.get("access-control-allow-origin")).toBe("https://www.catapacks.xyz");
      const local = await req("/health", { headers: { origin: "http://localhost:3100" } });
      expect(local.headers.get("access-control-allow-origin")).toBe("http://localhost:3100");
      const bad = await req("/health", { headers: { origin: "https://evil.example" } });
      expect(bad.headers.get("access-control-allow-origin")).toBeNull();
      process.env.CORS_ORIGIN = "https://a.example, https://b.example";
      const o = await req("/health", { headers: { origin: "https://b.example" } });
      expect(o.headers.get("access-control-allow-origin")).toBe("https://b.example");
    } finally {
      if (prev === undefined) delete process.env.CORS_ORIGIN; else process.env.CORS_ORIGIN = prev;
    }
  });

  it("binds 0.0.0.0 and reads PORT / DATA_DIR", () => {
    const keep = { PORT: process.env.PORT, DATA_DIR: process.env.DATA_DIR, HOST: process.env.HOST };
    try {
      delete process.env.HOST;
      process.env.PORT = "4321";
      process.env.DATA_DIR = "/data";
      const e = env();
      expect(e).toMatchObject({ port: 4321, dataDir: "/data", host: "0.0.0.0" });
    } finally {
      for (const [k, v] of Object.entries(keep)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  });
});
