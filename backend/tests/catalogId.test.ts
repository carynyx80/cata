import { describe, it, expect } from "vitest";
import { keccak256, stringToHex, decodeFunctionData } from "viem";
import { catalogId, price18 } from "../src/catalogId.js";
import { buildBatches } from "../src/jobs/pushPrices.js";
import { ABIS } from "../src/chain.js";
import { seedCards } from "../src/seed/cards.js";

describe("catalogId", () => {
  it("is keccak256(utf8(cardId:grade))", () => {
    expect(catalogId("pokemon:base1-4", "psa10")).toBe(keccak256(stringToHex("pokemon:base1-4:psa10")));
    expect(catalogId("pokemon:base1-4", "psa10")).toMatch(/^0x[0-9a-f]{64}$/);
    expect(catalogId("pokemon:base1-4", "psa9")).not.toBe(catalogId("pokemon:base1-4", "psa10"));
  });
  it("handles utf8 (é)", () => {
    expect(catalogId("magic:arn-27", "raw")).toBe(keccak256(new TextEncoder().encode("magic:arn-27:raw")));
  });
  it("price18 scales USD to 18 decimals", () => {
    expect(price18(9800)).toBe(9800n * 10n ** 18n);
    expect(price18(431.62)).toBe(43162n * 10n ** 16n);
  });
});

describe("pushPrices batches", () => {
  it("encodes setPrices(bytes32[],uint256[]) calldata in batches", () => {
    const cards = seedCards();
    const batches = buildBatches(cards, 50);
    const total = cards.reduce((n, c) => n + Object.values(c.prices).filter((p) => p! > 0).length, 0);
    expect(batches.reduce((n, b) => n + b.ids.length, 0)).toBe(total);
    expect(batches.every((b) => b.ids.length <= 50 && b.ids.length === b.prices.length)).toBe(true);
    const d = decodeFunctionData({ abi: ABIS.priceIndex, data: batches[0].calldata });
    expect(d.functionName).toBe("setPrices");
    expect(d.args![0]).toEqual(batches[0].ids);
    expect(batches[0].ids[0]).toBe(catalogId(batches[0].labels[0].replace(/:(raw|psa9|psa10)$/, ""), batches[0].labels[0].split(":").at(-1)!));
  });
});
