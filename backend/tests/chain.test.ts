import { describe, it, expect } from "vitest";
import { zeroAddress, type Address } from "viem";
import { makeApp } from "./helpers.js";
import { nullChain, ownedTokenIds, ABIS } from "../src/chain.js";
import { catalogId } from "../src/catalogId.js";
import { env } from "../src/env.js";

const W = "0x106342ec570e207afda9fda63125d7a9071127f2" as Address;
const OTHER = "0x0000000000000000000000000000000000000002" as Address;
const VAULT = "0x4444444444444444444444444444444444444444" as Address;

describe("generated ABIs match contracts", () => {
  const fn = (abi: readonly any[], name: string) => abi.find((x) => x.type === "function" && x.name === name);
  it("has the functions the backend calls", () => {
    expect(fn(ABIS.points, "points").inputs.map((i: any) => i.type)).toEqual(["address"]);
    expect(fn(ABIS.priceIndex, "priceUsd").outputs.map((o: any) => o.type)).toEqual(["uint256", "uint64"]);
    expect(fn(ABIS.priceIndex, "setPrices").inputs.map((i: any) => i.type)).toEqual(["bytes32[]", "uint256[]"]);
    expect(fn(ABIS.priceIndex, "priceOf")).toBeUndefined();
    expect(fn(ABIS.packMachine, "pools").outputs[0].components.map((c: any) => c.name)).toEqual(["name", "priceUsd", "active", "reserved"]);
    expect(fn(ABIS.packMachine, "poolCards").outputs[0].type).toBe("uint256[]");
    expect(fn(ABIS.vault, "catalogIdOf").outputs[0].type).toBe("bytes32");
    expect(fn(ABIS.vault, "tokenOfOwnerByIndex")).toBeUndefined();
    for (const f of ["cataToken", "cataActive", "feeBps"]) expect(fn(ABIS.cataConfig, f)).toBeTruthy();
  });
});

describe("ownedTokenIds (Transfer log reconstruction)", () => {
  it("replays in/out transfers in order and confirms with ownerOf", async () => {
    const log = (blockNumber: bigint, logIndex: number, from: Address, to: Address, tokenId: bigint) => ({ blockNumber, logIndex, args: { from, to, tokenId } });
    const all = [
      log(10n, 0, zeroAddress, W, 1n), log(11n, 0, zeroAddress, W, 2n), log(12n, 1, W, OTHER, 1n),
      log(15n, 0, OTHER, W, 3n), log(9000n, 0, zeroAddress, W, 4n),
    ];
    const calls: [bigint, bigint][] = [];
    const client: any = {
      getBlockNumber: async () => 9999n,
      getLogs: async ({ args, fromBlock, toBlock }: any) => {
        calls.push([fromBlock, toBlock]);
        return all.filter((l) => l.blockNumber >= fromBlock && l.blockNumber <= toBlock &&
          (args.to ? l.args.to === args.to : l.args.from === args.from));
      },
      multicall: async ({ contracts }: any) => contracts.map((c: any) => ({ status: "success", result: c.args[0] === 3n ? OTHER : W })),
    };
    const ids = await ownedTokenIds(client, VAULT, W, 0n, 5000n);
    expect(ids.sort()).toEqual([2n, 4n]); // 1 sent away; 3 no longer owned per ownerOf
    expect(calls.length).toBe(4); // 2 chunks x (to, from)
  });
});

describe("chain-backed endpoints (mocked reader)", () => {
  const e = () => {
    const saved = { ...process.env };
    Object.assign(process.env, { PACK_MACHINE_ADDRESS: VAULT, CATA_VAULT_ADDRESS: VAULT, CATA_CONFIG_ADDRESS: VAULT, CATA_TOKEN: "" });
    const out = env(); process.env = saved; return out;
  };
  const lotus = catalogId("magic:lea-232", "psa9");
  const pika = catalogId("pokemon:base1-58", "raw");
  const { req } = makeApp({
    env: e,
    chain: {
      ...nullChain,
      cataToken: async () => zeroAddress,
      feeBps: async () => 25,
      pointsOf: async () => 4200n,
      ownedCatalogIds: async () => [catalogId("pokemon:base1-4", "psa10"), catalogId("pokemon:base1-2", "raw"), catalogId("pokemon:base1-15", "psa9")],
      pools: async () => [{ id: 0, name: "lotus or bust", priceUsd18: 500n * 10n ** 18n, active: true, reserved: 1,
        cards: [{ tokenId: 1n, catalogId: lotus }, { tokenId: 2n, catalogId: pika }, { tokenId: 3n, catalogId: pika }] }],
    },
  });
  it("pools from chain resolve catalogIds to cards", async () => {
    const p = await (await req("/pools/0")).json();
    expect(p).toMatchObject({ source: "chain", priceUsd: 500, cardsLeft: 3, grailsLeft: 1, reserved: 1 });
    expect(p.cards[0]).toMatchObject({ cardId: "magic:lea-232", grade: "psa9", remaining: 1, valueUsd: 145000 });
    expect(p.cards[1]).toMatchObject({ cardId: "pokemon:base1-58", remaining: 2 });
  });
  it("points, set progress and feeBps from chain", async () => {
    expect(await (await req(`/points/${W}`)).json()).toMatchObject({ points: "4200", source: "chain" });
    expect(await (await req(`/sets/base-starters/progress/${W}`)).json()).toMatchObject({ source: "chain", owned: 3, complete: true });
    expect(await (await req("/config")).json()).toMatchObject({ feeBps: 25, cataActive: false, cataTokenSource: "chain" });
  });
});
