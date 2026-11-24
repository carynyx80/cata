import { createPublicClient, http, zeroAddress, type Address, type Hex, type PublicClient } from "viem";
import { bsc } from "viem/chains";
import type { Env } from "./env.js";
import { cataConfigAbi } from "./abis/CataConfig.js";
import { cataPointsAbi } from "./abis/CataPoints.js";
import { cataPriceIndexAbi } from "./abis/CataPriceIndex.js";
import { cataVaultAbi } from "./abis/CataVault.js";
import { packMachineAbi } from "./abis/PackMachine.js";

/** ABIs generated from contracts/out by `npm run gen:abis` (scripts/gen-abis.mjs). */
export const ABIS = {
  cataConfig: cataConfigAbi,
  points: cataPointsAbi,
  priceIndex: cataPriceIndexAbi,
  vault: cataVaultAbi,
  packMachine: packMachineAbi,
};

export interface OnchainPool {
  id: number;
  name: string;
  priceUsd18: bigint; // PackMachine.Pool.priceUsd (18 decimals)
  active: boolean;
  reserved: number; // cards reserved by unopened credits / pending VRF
  cards: { tokenId: bigint; catalogId: Hex }[];
}

/** Everything the API reads from chain. Each method returns null when its contract is not configured. */
/** CataVault.cardOf(tokenId): the slab's on-chain record. */
export interface VaultCard {
  catalogId: Hex;
  grade: number;
  grader: Hex; // bytes16, ASCII right-padded with zeros
  cert: string;
  physical: boolean;
}

export interface ChainReader {
  cataToken(): Promise<Address | null>;
  feeBps(): Promise<number | null>;
  pointsOf(wallet: Address): Promise<bigint | null>;
  pools(): Promise<OnchainPool[] | null>;
  ownedCatalogIds(wallet: Address): Promise<Hex[] | null>;
  /** null when the vault is not configured; throws TokenNotFoundError when the token does not exist. */
  vaultCard(tokenId: bigint): Promise<VaultCard | null>;
}

export class TokenNotFoundError extends Error {}

export const nullChain: ChainReader = {
  cataToken: async () => null,
  feeBps: async () => null,
  pointsOf: async () => null,
  pools: async () => null,
  ownedCatalogIds: async () => null,
  vaultCard: async () => null,
};

async function catalogIdsOf(client: PublicClient, vault: Address, tokenIds: bigint[]): Promise<Hex[]> {
  if (!tokenIds.length) return [];
  const res = await client.multicall({
    allowFailure: false,
    contracts: tokenIds.map((id) => ({ address: vault, abi: cataVaultAbi, functionName: "catalogIdOf" as const, args: [id] as const })),
  });
  return res as Hex[];
}

/**
 * CataVault is plain ERC721 (not Enumerable): reconstruct a wallet's tokens from Transfer logs
 * (to/from wallet) since VAULT_DEPLOY_BLOCK, in chunks of VAULT_LOG_CHUNK blocks, then confirm with ownerOf.
 */
export async function ownedTokenIds(client: PublicClient, vault: Address, wallet: Address, fromBlock: bigint, chunk: bigint): Promise<bigint[]> {
  const event = cataVaultAbi.find((x) => x.type === "event" && x.name === "Transfer")!;
  const latest = await client.getBlockNumber();
  const logs: { blockNumber: bigint; logIndex: number; from: Address; to: Address; tokenId: bigint }[] = [];
  for (let start = fromBlock; start <= latest; start += chunk) {
    const end = start + chunk - 1n > latest ? latest : start + chunk - 1n;
    const [inb, outb] = await Promise.all([
      client.getLogs({ address: vault, event: event as any, args: { to: wallet }, fromBlock: start, toBlock: end }),
      client.getLogs({ address: vault, event: event as any, args: { from: wallet }, fromBlock: start, toBlock: end }),
    ]);
    for (const l of [...inb, ...outb] as any[]) {
      logs.push({ blockNumber: l.blockNumber, logIndex: l.logIndex, from: l.args.from, to: l.args.to, tokenId: l.args.tokenId });
    }
  }
  logs.sort((a, b) => (a.blockNumber === b.blockNumber ? a.logIndex - b.logIndex : a.blockNumber < b.blockNumber ? -1 : 1));
  const held = new Set<bigint>();
  const w = wallet.toLowerCase();
  for (const l of logs) {
    if (l.to.toLowerCase() === w) held.add(l.tokenId);
    else if (l.from.toLowerCase() === w) held.delete(l.tokenId);
  }
  const ids = [...held];
  if (!ids.length) return [];
  const owners = await client.multicall({
    allowFailure: true,
    contracts: ids.map((id) => ({ address: vault, abi: cataVaultAbi, functionName: "ownerOf" as const, args: [id] as const })),
  });
  return ids.filter((_, i) => owners[i].status === "success" && String(owners[i].result).toLowerCase() === w);
}

export function createChainReader(e: Env): ChainReader {
  const client = createPublicClient({ chain: bsc, transport: http(e.rpcUrl, { timeout: 8000 }) }) as PublicClient;
  const c = e.contracts;
  return {
    async cataToken() {
      if (!c.cataConfig) return null;
      const a = await client.readContract({ address: c.cataConfig, abi: cataConfigAbi, functionName: "cataToken" });
      return a === zeroAddress ? zeroAddress : (a as Address);
    },
    async feeBps() {
      if (!c.cataConfig) return null;
      return Number(await client.readContract({ address: c.cataConfig, abi: cataConfigAbi, functionName: "feeBps" }));
    },
    async pointsOf(wallet) {
      if (!c.points) return null;
      return (await client.readContract({ address: c.points, abi: cataPointsAbi, functionName: "points", args: [wallet] })) as bigint;
    },
    async pools() {
      if (!c.packMachine || !c.vault) return null;
      const pm = c.packMachine, vault = c.vault;
      const n = Number(await client.readContract({ address: pm, abi: packMachineAbi, functionName: "poolCount" }));
      const out: OnchainPool[] = [];
      for (let i = 0; i < Math.min(n, 100); i++) {
        const [pool, tokenIds] = await Promise.all([
          client.readContract({ address: pm, abi: packMachineAbi, functionName: "pools", args: [BigInt(i)] }),
          client.readContract({ address: pm, abi: packMachineAbi, functionName: "poolCards", args: [BigInt(i)] }),
        ]);
        const p = pool as { name: string; priceUsd: bigint; active: boolean; reserved: bigint };
        const ids = tokenIds as readonly bigint[];
        const cats = await catalogIdsOf(client, vault, [...ids]);
        out.push({ id: i, name: p.name, priceUsd18: p.priceUsd, active: p.active, reserved: Number(p.reserved),
          cards: ids.map((tokenId, j) => ({ tokenId, catalogId: cats[j] })) });
      }
      return out;
    },
    async ownedCatalogIds(wallet) {
      if (!c.vault) return null;
      const ids = await ownedTokenIds(client, c.vault, wallet, e.vaultDeployBlock, e.vaultLogChunk);
      return catalogIdsOf(client, c.vault, ids);
    },
    async vaultCard(tokenId) {
      if (!c.vault) return null;
      try {
        const r = (await client.readContract({ address: c.vault, abi: cataVaultAbi, functionName: "cardOf", args: [tokenId] })) as VaultCard;
        return { catalogId: r.catalogId, grade: Number(r.grade), grader: r.grader, cert: r.cert, physical: r.physical };
      } catch (err) {
        // ERC721NonexistentToken (OZ _requireOwned) or any other revert from cardOf
        if (err instanceof Error && /revert|NonexistentToken/i.test(err.message)) throw new TokenNotFoundError(String(tokenId));
        throw err;
      }
    },
  };
}
