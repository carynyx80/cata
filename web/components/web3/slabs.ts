"use client";
import { useQuery } from "@tanstack/react-query";
import { useAccount, useConfig } from "wagmi";
import { readContract, getPublicClient } from "wagmi/actions";
import { hexToString, parseAbiItem, type Address } from "viem";
import { cataVaultAbi } from "@/lib/abis";
import { addresses, VAULT_DEPLOY_BLOCK } from "@/lib/contracts";
import { api } from "@/lib/api";
import type { Card } from "@/lib/data";

const hues: [string, string][] = [["#F6A15B", "#E2487F"], ["#2B1A22", "#6B4BA8"], ["#E2487F", "#F7D26A"], ["#3D7BD9", "#9AD3E8"], ["#9AD3E8", "#F4C3D3"], ["#C9D6F2", "#F4C3D3"]];
const glyphs: Card["glyph"][] = ["flame", "moon", "star", "ball", "wave", "bolt"];

export type Slabbed = Card & { tokenId: bigint; physical: boolean; valueUsd?: number; cardId?: string | null };

type Meta = { name: string; cardId: string | null };

/** Build a Slab-ready card for a vault token from CataVault.cardOf + backend /metadata/:tokenId. */
export async function loadSlab(config: ReturnType<typeof useConfig>, tokenId: bigint): Promise<Slabbed> {
  const vault = addresses.vault!;
  const c = (await readContract(config, { address: vault, abi: cataVaultAbi, functionName: "cardOf", args: [tokenId] })) as {
    catalogId: `0x${string}`; grade: number; grader: `0x${string}`; cert: string; physical: boolean;
  };
  const meta = await api<Meta>(`/metadata/${tokenId}`).catch(() => null);
  const i = Number(tokenId % BigInt(hues.length));
  const grader = hexToString(c.grader, { size: 16 }).replace(/\0/g, "").toLowerCase();
  let value: number | undefined;
  if (meta?.cardId) {
    const card = await api<{ prices: { raw?: number; psa9?: number; psa10?: number } }>(`/cards/${encodeURIComponent(meta.cardId)}`).catch(() => null);
    value = card ? (c.grade >= 10 ? card.prices.psa10 : c.grade >= 9 ? card.prices.psa9 : card.prices.raw) : undefined;
  }
  return {
    id: String(tokenId), tokenId, name: (meta?.name?.split(" · ")[0] ?? `slab #${tokenId}`).toLowerCase(), set: "cata vault",
    grade: c.grade > 0 ? String(c.grade) : "raw", grader: grader || "raw", cert: c.cert || "—", value: value ?? 0,
    hue: hues[i], glyph: glyphs[i], digital: !c.physical, physical: c.physical, valueUsd: value, cardId: meta?.cardId,
  };
}

/** getLogs in 5k-block chunks from NEXT_PUBLIC_VAULT_DEPLOY_BLOCK (or the last ~200k blocks). */
export async function chunkedLogs<T>(config: ReturnType<typeof useConfig>, fetch: (from: bigint, to: bigint) => Promise<T[]>): Promise<T[]> {
  const client = getPublicClient(config)!;
  const head = await client.getBlockNumber();
  const start = VAULT_DEPLOY_BLOCK > 0n ? VAULT_DEPLOY_BLOCK : head > 200_000n ? head - 200_000n : 0n;
  const out: T[] = [];
  for (let from = start; from <= head; from += 5000n) {
    const to = from + 4999n > head ? head : from + 4999n;
    out.push(...(await fetch(from, to)));
  }
  return out;
}

const transfer = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)");

/**
 * The connected wallet's slabs. CataVault is not enumerable, so (like the backend) rebuild from
 * Transfer logs since NEXT_PUBLIC_VAULT_DEPLOY_BLOCK and confirm each with ownerOf.
 */
export function useMySlabs() {
  const config = useConfig();
  const { address } = useAccount();
  return useQuery({
    queryKey: ["slabs", address],
    enabled: !!address && !!addresses.vault,
    staleTime: 30_000,
    queryFn: async () => {
      const client = getPublicClient(config)!;
      const vault = addresses.vault!;
      const logs = await chunkedLogs(config, (fromBlock, toBlock) => client.getLogs({ address: vault, event: transfer, args: { to: address as Address }, fromBlock, toBlock }));
      const ids = [...new Set(logs.map((l) => l.args.tokenId!).filter((x) => x !== undefined))];
      const owners = await Promise.all(ids.map((id) =>
        readContract(config, { address: vault, abi: cataVaultAbi, functionName: "ownerOf", args: [id] }).catch(() => null)));
      const mine = ids.filter((_, i) => (owners[i] as string | null)?.toLowerCase() === address!.toLowerCase());
      return Promise.all(mine.map((id) => loadSlab(config, id)));
    },
  });
}
