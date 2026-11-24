"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Slab } from "@/components/Slab";
import { Reveal } from "@/components/Reveal";
import { Act } from "@/components/web3/Act";
import { useTx } from "@/components/web3/tx";
import dynamic from "next/dynamic";
import type { Pending } from "@/components/web3/PackReveal";
import { readContract } from "wagmi/actions";
import { decodeEventLog, parseUnits, type Abi } from "viem";
import { packMachineAbi } from "@/lib/abis";
import { addresses, payToken } from "@/lib/contracts";
import { api, type ApiPool } from "@/lib/api";
import { cards, fmt } from "@/lib/data";

const tiers = [
  { name: "starter", price: 25, tone: "bg-surface", odds: [["$10–25", "62%"], ["$25–75", "28%"], ["$75–250", "8.5%"], ["$250+", "1.5%"]], left: 412 },
  { name: "collector", price: 50, tone: "bg-soft", odds: [["$25–50", "55%"], ["$50–150", "32%"], ["$150–500", "11%"], ["$500+", "2%"]], left: 238, hot: true },
  { name: "grail", price: 250, tone: "bg-ink text-surface", odds: [["$150–250", "48%"], ["$250–750", "35%"], ["$750–2.5k", "14%"], ["$2.5k+", "3%"]], left: 57 },
];
const pays = ["bnb", "usdt", "$cata"] as const;
// only needed after a pack is bought
const PackReveal = dynamic(() => import("@/components/web3/PackReveal").then((m) => m.PackReveal), { ssr: false });

/** Match a tier to a backend/on-chain pool by name, else by position. */
const poolFor = (pools: ApiPool[] | undefined, name: string, i: number) =>
  pools?.find((p) => p.name.toLowerCase().includes(name)) ?? pools?.[i];

export default function Packs() {
  const [pay, setPay] = useState<(typeof pays)[number]>("bnb");
  const [pending, setPending] = useState<Pending | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const { run, config } = useTx();
  const pools = useQuery({ queryKey: ["pools"], queryFn: () => api<{ items: ApiPool[] } | ApiPool[]>("/pools"), retry: 1, staleTime: 30_000 });
  const poolList = Array.isArray(pools.data) ? pools.data : pools.data?.items;
  const onchain = poolList?.some((p) => p.source === "chain");

  const openPack = async (name: string, i: number, shownPrice: number) => {
    const pm = addresses.packMachine!;
    const pool = poolFor(onchain ? poolList : undefined, name, i);
    const poolId = BigInt(pool?.id ?? i);
    const token = payToken(pay)!;
    // send maxPriceUsd = displayed price + 1% buffer (contract reverts if the pool price moved above it)
    const maxPriceUsd = parseUnits((shownPrice * 1.01).toFixed(6), 18);
    setOpening(name);
    try {
      const quote = (await readContract(config, { address: pm, abi: packMachineAbi, functionName: "quote", args: [poolId, token] })) as bigint;
      const buffered = (quote * 101n) / 100n; // bnb excess is refunded
      const receipt = await run(`open ${name} pack`, {
        address: pm, abi: packMachineAbi as Abi, functionName: "open", args: [poolId, token, maxPriceUsd], value: pay === "bnb" ? buffered : undefined,
      }, pay === "bnb" ? {} : { approve: { token, amount: quote } });
      let creditId: bigint | undefined, requestId: bigint | undefined;
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== pm.toLowerCase()) continue;
        try {
          const ev = decodeEventLog({ abi: packMachineAbi, data: log.data, topics: log.topics });
          if (ev.eventName === "OpenRequested") { creditId = ev.args.creditId; requestId = ev.args.requestId; }
        } catch { /* other event */ }
      }
      if (creditId !== undefined) setPending({ creditId, requestId, pool: name, fromBlock: receipt.blockNumber });
    } catch { /* toast already shown */ } finally {
      setOpening(null);
    }
  };
  return (
    <div className="mx-auto max-w-7xl px-4 pt-10 sm:pt-16 md:px-8">
      <Reveal>
        <p className="font-mono text-xs uppercase tracking-[.2em] text-pink">packs</p>
        <h1 className="mt-4 font-display text-[clamp(2.4rem,9vw,6rem)] leading-[.95]">pick your rip.</h1>
        <p className="mt-5 max-w-xl text-lg text-muted sm:text-xl">published odds. public pools. every pull settled by chainlink vrf. don&apos;t love it? sell it back for 85%.</p>
      </Reveal>

      <div role="group" aria-label="pay with" className="mt-8 inline-flex max-w-full rounded-full bg-surface p-1.5 font-mono text-sm sm:mt-10">
        {pays.map((p) => {
          const soon = p === "$cata";
          return (
            <button key={p} disabled={soon} onClick={() => setPay(p)} aria-pressed={pay === p}
              className={`relative min-h-10 rounded-full px-4 py-2 transition pointer-coarse:min-h-11 sm:px-5 ${soon ? "cursor-not-allowed text-muted/50" : "hover:text-ink"} ${pay === p ? "text-surface" : "text-muted"}`}>
              {pay === p && <motion.span layoutId="pay" className="absolute inset-0 rounded-full bg-ink" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
              <span className="relative">{p}{soon && <span className="ml-1.5 text-[10px]">soon</span>}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {tiers.map((t, i) => {
          const pool = poolFor(onchain ? poolList : undefined, t.name, i);
          const price = pool?.priceUsd ?? t.price;
          const left = pool?.cardsLeft ?? t.left;
          return (
          <Reveal key={t.name} delay={i * .08}>
            <div className={`group relative h-full rounded-[32px] p-6 transition-all sm:rounded-[36px] sm:p-8 duration-300 hover:-translate-y-2 hover:shadow-[0_40px_70px_-35px_rgba(43,26,34,.5)] ${t.tone}`}>
              {t.hot && <span className="absolute right-5 top-5 rounded-full bg-pink sm:right-6 sm:top-6 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-surface">most ripped</span>}
              <div className="font-mono text-xs uppercase tracking-[.2em] opacity-70">{t.name}</div>
              <div className="mt-6 font-display text-[clamp(3rem,14vw,3.75rem)] leading-none">${price.toLocaleString("en-US")}</div>
              <div className="mt-1 font-mono text-xs opacity-60">paid in {pay} · +0.2% burn fee</div>
              <table className="mt-8 w-full font-mono text-sm">
                <caption className="sr-only">{t.name} pack odds</caption>
                <thead><tr className="text-left text-[10px] uppercase tracking-widest opacity-60"><th scope="col" className="pb-2 font-normal">pull value</th><th scope="col" className="pb-2 text-right font-normal">odds</th></tr></thead>
                <tbody>{t.odds.map(([v, o]) => (
                  <tr key={v} className="border-t border-current/10"><td className="py-2.5">{v}</td><td className="py-2.5 text-right">{o}</td></tr>
                ))}</tbody>
              </table>
              <div className="mt-6 font-mono text-xs opacity-70">{left} cards left in pool</div>
              <Act need={["packMachine", "vault"]} onClick={() => openPack(t.name, i, price)} busy={opening === t.name} busyLabel="opening…" disabled={!!opening}
                className={`mt-6 w-full rounded-full py-4 text-lg font-medium transition ${t.name === "grail" ? "bg-pink text-surface hover:bg-surface hover:text-ink" : "bg-ink text-surface hover:bg-pink"}`}>
                open {t.name} pack
              </Act>
            </div>
          </Reveal>
          );
        })}
      </div>

      <section className="mt-16 sm:mt-24">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[.2em] text-pink">glass pack · collector pool</p>
              <h2 className="mt-3 font-display text-[clamp(2rem,4.5vw,3.5rem)] leading-[1]">what&apos;s still inside.</h2>
            </div>
            <div className="font-mono text-sm text-muted">238 left · 762 pulled · pool value {fmt(48210)}</div>
          </div>
        </Reveal>
        <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-6 min-[480px]:grid-cols-3 sm:grid-cols-4 sm:gap-5 lg:grid-cols-8">
          {cards.map((c, i) => (
            <Reveal key={c.id} delay={i * .04}>
              <Slab card={c} className="!border-[4px] !p-2" />
              <div className="mt-3 flex justify-between font-mono text-[11px]"><span className="text-muted">×{(i * 7) % 13 + 1} left</span><span>{fmt(c.value)}</span></div>
            </Reveal>
          ))}
        </div>
      </section>
      {pending && <PackReveal key={String(pending.creditId)} pending={pending} onClose={() => setPending(null)} />}
    </div>
  );
}
