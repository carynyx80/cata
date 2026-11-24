import { createPublicClient, http, parseAbi, zeroAddress, type Address, type Hex } from "viem";
import { bsc } from "viem/chains";
import type { Env } from "./env.js";

/**
 * Minimal ABIs for the reads the backend needs. These are the interface the backend
 * expects from contracts/ — keep in sync if function names change there.
 */
export const ABIS = {
  cataConfig: parseAbi(["function cataToken() view returns (address)"]),
  points: parseAbi(["function pointsOf(address user) view returns (uint256)"]),
  priceIndex: parseAbi([
    "function setPrices(bytes32[] ids, uint256[] prices)",
    "function priceOf(bytes32 id) view returns (uint256)",
  ]),
  packMachine: parseAbi([
    "function poolCount() view returns (uint256)",
    "function pools(uint256 poolId) view returns (string name, uint256 price, address payToken, bool active)",
    "function poolContents(uint256 poolId) view returns (bytes32[] catalogIds, uint256[] remaining)",
  ]),
  vault: parseAbi([
    "function balanceOf(address owner) view returns (uint256)",
    "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
    "function catalogIdOf(uint256 tokenId) view returns (bytes32)",
  ]),
};

export interface OnchainPool {
  id: number;
  name: string;
  price: bigint;
  payToken: Address;
  active: boolean;
  contents: { catalogId: Hex; remaining: number }[];
}

/** Everything the API reads from chain. Each method returns null when not configured. */
export interface ChainReader {
  cataToken(): Promise<Address | null>;
  pointsOf(wallet: Address): Promise<bigint | null>;
  pools(): Promise<OnchainPool[] | null>;
  ownedCatalogIds(wallet: Address): Promise<Hex[] | null>;
}

export const nullChain: ChainReader = {
  cataToken: async () => null,
  pointsOf: async () => null,
  pools: async () => null,
  ownedCatalogIds: async () => null,
};

export function createChainReader(e: Env): ChainReader {
  const client = createPublicClient({ chain: bsc, transport: http(e.rpcUrl, { timeout: 8000 }) });
  const c = e.contracts;
  return {
    async cataToken() {
      if (!c.cataConfig) return null;
      const a = await client.readContract({ address: c.cataConfig, abi: ABIS.cataConfig, functionName: "cataToken" });
      return a === zeroAddress ? zeroAddress : a;
    },
    async pointsOf(wallet) {
      if (!c.points) return null;
      return client.readContract({ address: c.points, abi: ABIS.points, functionName: "pointsOf", args: [wallet] });
    },
    async pools() {
      if (!c.packMachine) return null;
      const pm = c.packMachine;
      const n = Number(await client.readContract({ address: pm, abi: ABIS.packMachine, functionName: "poolCount" }));
      const out: OnchainPool[] = [];
      for (let i = 0; i < Math.min(n, 100); i++) {
        const [name, price, payToken, active] = await client.readContract({ address: pm, abi: ABIS.packMachine, functionName: "pools", args: [BigInt(i)] });
        const [ids, rem] = await client.readContract({ address: pm, abi: ABIS.packMachine, functionName: "poolContents", args: [BigInt(i)] });
        out.push({ id: i, name, price, payToken, active, contents: ids.map((id, j) => ({ catalogId: id, remaining: Number(rem[j]) })) });
      }
      return out;
    },
    async ownedCatalogIds(wallet) {
      if (!c.vault) return null;
      const v = c.vault;
      const bal = Number(await client.readContract({ address: v, abi: ABIS.vault, functionName: "balanceOf", args: [wallet] }));
      const ids: Hex[] = [];
      for (let i = 0; i < Math.min(bal, 500); i++) {
        const tokenId = await client.readContract({ address: v, abi: ABIS.vault, functionName: "tokenOfOwnerByIndex", args: [wallet, BigInt(i)] });
        ids.push(await client.readContract({ address: v, abi: ABIS.vault, functionName: "catalogIdOf", args: [tokenId] }));
      }
      return ids;
    },
  };
}
