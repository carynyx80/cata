"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Reveal } from "@/components/Reveal";
import { useQuery } from "@tanstack/react-query";
import { useConfig } from "wagmi";
import { readContract } from "wagmi/actions";
import { formatUnits, parseUnits, type Abi, type Address } from "viem";
import { Page, PageHead, PayToggle, Toggle, input, type Pay } from "@/components/ui";
import { Act } from "@/components/web3/Act";
import { useCata } from "@/components/web3/Providers";
import { useTx } from "@/components/web3/tx";
import { predictionMarketAbi } from "@/lib/abis";
import { addresses, payToken } from "@/lib/contracts";

const FEE = 0.002;
/** `pools` holds per-currency outcome pools for on-chain markets (each currency is a separate pool). */
type Market = { q: string; close: string; outcomes: { name: string; pool: number }[]; id?: bigint; status?: number; pools?: Partial<Record<Pay, number[]>> };
const kindTab = ["live rips", "pack pools", "card prices"] as const;

/** Read every PredictionMarket market plus its bnb/usdt/(cata) pools. */
function useChainMarkets(cata: Address | null) {
  const config = useConfig();
  return useQuery({
    queryKey: ["pm", cata], enabled: !!addresses.prediction, staleTime: 20_000,
    queryFn: async () => {
      const pm = addresses.prediction!;
      const n = Number(await readContract(config, { address: pm, abi: predictionMarketAbi, functionName: "marketsCount" }));
      const out: Record<(typeof kindTab)[number], Market[]> = { "live rips": [], "pack pools": [], "card prices": [] };
      for (let i = Math.max(0, n - 60); i < n; i++) {
        const id = BigInt(i);
        const m = (await readContract(config, { address: pm, abi: predictionMarketAbi, functionName: "getMarket", args: [id] })) as {
          kind: number; status: number; outcomesCount: number; closeTime: bigint; question: string;
        };
        if (m.status === 3) continue; // cancelled
        const [q, ...names] = m.question.split(" | ");
        const pools: Partial<Record<Pay, number[]>> = {};
        for (const pay of ["bnb", "usdt", "$cata"] as Pay[]) {
          const token = payToken(pay, cata);
          if (!token) continue;
          pools[pay] = await Promise.all(Array.from({ length: m.outcomesCount }, (_, o) =>
            readContract(config, { address: pm, abi: predictionMarketAbi, functionName: "outcomePool", args: [id, token, o] })
              .then((v) => Number(formatUnits(v as bigint, 18)))));
        }
        const close = new Date(Number(m.closeTime) * 1000);
        out[kindTab[m.kind] ?? "card prices"].push({
          id, status: m.status, q,
          close: m.status === 0 ? `closes ${close.toUTCString().slice(5, 22).toLowerCase()} utc` : m.status === 2 ? "resolved" : "resolving",
          outcomes: Array.from({ length: m.outcomesCount }, (_, o) => ({ name: names[o] ?? (m.outcomesCount === 2 ? ["yes", "no"][o] : `outcome ${o + 1}`), pool: pools.bnb?.[o] ?? 0 })),
          pools,
        });
      }
      return out;
    },
  });
}
const tabs = ["live rips", "pack pools", "card prices"] as const;
const markets: Record<(typeof tabs)[number], Market[]> = {
  "live rips": [
    { q: "tonight's evolving skies box: alt art umbreon pulled?", close: "closes 21:00 utc · today", outcomes: [{ name: "yes", pool: 4.2 }, { name: "no", pool: 11.8 }] },
    { q: "how many psa-10-worthy hits in the 151 case break?", close: "closes 19:30 utc · tomorrow", outcomes: [{ name: "0–1", pool: 3.1 }, { name: "2–3", pool: 6.4 }, { name: "4+", pool: 1.9 }] },
  ],
  "pack pools": [
    { q: "charizard pulled from grail pool this week?", close: "closes sun 23:59 utc", outcomes: [{ name: "yes", pool: 18.6 }, { name: "no", pool: 11.4 }] },
    { q: "collector pool sells out before dec 15?", close: "closes dec 15", outcomes: [{ name: "yes", pool: 7.7 }, { name: "no", pool: 9.3 }] },
  ],
  "card prices": [
    { q: "umbreon vmax alt art psa 10 above $1,800 by dec 31?", close: "closes dec 31", outcomes: [{ name: "yes", pool: 9.5 }, { name: "no", pool: 15.5 }] },
    { q: "wembanyama prizm rc psa 10 on jan 31", close: "closes jan 31", outcomes: [{ name: "< $800", pool: 2.2 }, { name: "$800–1k", pool: 5.1 }, { name: "> $1k", pool: 3.7 }] },
  ],
};

function MarketCard({ m, idx }: { m: Market; idx: string }) {
  const [pick, setPick] = useState(0);
  const [cur, setCur] = useState<Pay>("bnb");
  const [stake, setStake] = useState("0.5");
  const { token: cata } = useCata();
  const { run, busy, address, config } = useTx();
  const [claimable, setClaimable] = useState<bigint>(0n);
  const onchain = m.id !== undefined && !!m.pools;
  const outcomes = onchain ? m.outcomes.map((o, i) => ({ ...o, pool: m.pools?.[cur]?.[i] ?? 0 })) : m.outcomes;
  const total = outcomes.reduce((s, o) => s + o.pool, 0) || 1e-18;
  const s = Math.max(0, parseFloat(stake) || 0);
  const unit = cur === "bnb" ? "bnb" : cur === "usdt" ? "usdt" : "$cata";
  const scale = onchain ? 1 : cur === "usdt" ? 620 : 1; // sample: usdt pools mirror bnb pools
  const token = payToken(cur, cata);
  useEffect(() => {
    if (!onchain || !address || !token || !addresses.prediction) return;
    readContract(config, { address: addresses.prediction, abi: predictionMarketAbi, functionName: "claimable", args: [m.id!, token, address] })
      .then((v) => setClaimable(v as bigint)).catch(() => setClaimable(0n));
  }, [onchain, address, token, config, m.id, busy]);
  const placeBet = async () => {
    if (!token || m.id === undefined) return;
    const amount = parseUnits(stake, 18);
    try {
      await run(`bet ${outcomes[pick].name}`, { address: addresses.prediction!, abi: predictionMarketAbi as Abi, functionName: "bet", args: [m.id, pick, token, amount], value: cur === "bnb" ? amount : undefined },
        cur === "bnb" ? {} : { approve: { token, amount } });
    } catch { /* toast */ }
  };
  const claim = async () => {
    if (!token || m.id === undefined) return;
    try { await run("claim winnings", { address: addresses.prediction!, abi: predictionMarketAbi as Abi, functionName: "claim", args: [m.id, token] }); } catch { /* toast */ }
  };
  // matches PredictionMarket.sol: fee taken at bet time, net stake joins the pool,
  // payout = net * (totalPool + net) / (outcomePool + net)
  const net = s * (1 - FEE);
  const shown = net > 0 ? (net * (total * scale + net)) / (outcomes[pick].pool * scale + net) : 0;
  return (
    <div className="grid gap-6 rounded-[32px] bg-surface p-6 md:p-8 lg:grid-cols-[1.3fr_1fr]">
      <div>
        <div className="font-mono text-[11px] text-muted">{m.close}</div>
        <h3 className="mt-2 font-display text-2xl leading-tight">{m.q}</h3>
        <div className="mt-5 space-y-2.5">
          {outcomes.map((o, i) => {
            const odds = (o.pool / total) * 100;
            return (
              <button key={o.name} onClick={() => setPick(i)}
                className={`block w-full rounded-2xl p-3.5 text-left transition ${pick === i ? "bg-ink text-surface" : "bg-cream hover:bg-soft/60"}`}>
                <div className="flex justify-between gap-4 text-sm"><span className="font-medium">{o.name}</span>
                  <span className="font-mono">{odds.toFixed(0)}% · {(o.pool * scale).toLocaleString("en-US", { maximumFractionDigits: 1 })} {unit}</span></div>
                <div className={`mt-2.5 h-1.5 rounded-full ${pick === i ? "bg-surface/15" : "bg-ink/10"}`}>
                  <motion.div className="h-full rounded-full bg-pink" initial={{ width: 0 }} whileInView={{ width: `${odds}%` }} viewport={{ once: true }} transition={{ duration: .8, ease: [0.22, 1, 0.36, 1] }} />
                </div>
              </button>
            );
          })}
        </div>
        <div className="mt-3 font-mono text-[11px] text-muted">total pool {(total * scale).toLocaleString("en-US", { maximumFractionDigits: 1 })} {unit} · implied odds = share of pool</div>
      </div>
      <div className="rounded-3xl bg-cream p-5">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted">bet on <span className="text-ink">{outcomes[pick].name}</span></div>
        <div className="mt-3"><PayToggle value={cur} onChange={setCur} id={`pp-${idx}`} size="sm" /></div>
        <label className="mt-4 block font-mono text-[10px] uppercase tracking-widest text-muted">stake ({unit})</label>
        <input value={stake} onChange={(e) => setStake(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" className={`${input} mt-1.5 bg-surface text-lg`} />
        <div className="mt-4 flex items-end justify-between font-mono">
          <span className="text-xs text-muted">est. payout</span>
          <span className="text-2xl">{shown.toLocaleString("en-US", { maximumFractionDigits: 3 })} {unit}</span>
        </div>
        <div className="mt-1 text-right font-mono text-[10px] text-muted">{s > 0 ? `${(shown / s).toFixed(2)}× · ` : ""}after 0.2% fee · moves as pools change</div>
        <Act need={["prediction"]} onClick={placeBet} busy={busy} busyLabel="placing…" disabled={s <= 0 || !onchain || m.status !== 0 || !token}
          soonLabel="markets launching soon" className="mt-5 w-full rounded-full bg-pink py-3 font-medium text-surface transition hover:bg-deep disabled:opacity-40">place bet</Act>
        {claimable > 0n && (
          <button onClick={claim} disabled={busy} className="mt-2 w-full rounded-full bg-ink py-3 font-medium text-surface transition hover:bg-deep">
            claim {Number(formatUnits(claimable, 18)).toLocaleString("en-US", { maximumFractionDigits: 4 })} {unit}
          </button>
        )}
      </div>
    </div>
  );
}

export default function Predict() {
  const [tab, setTab] = useState<(typeof tabs)[number]>("live rips");
  const { token: cata } = useCata();
  const chain = useChainMarkets(cata);
  const list = chain.data && Object.values(chain.data).some((l) => l.length) ? chain.data : markets;
  return (
    <Page>
      <PageHead kicker="prediction markets" title="bet on the rip." sub="parimutuel pools. winners split the pot, pro rata. no house edge beyond the 0.2% burn." />
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Toggle options={tabs} value={tab} onChange={setTab} id="ptab" />
        <span className="rounded-full border border-ink/15 px-4 py-2 font-mono text-[11px] text-muted">only bet what you can lose. markets settle on-chain.</span>
      </div>
      <div className="mt-8 space-y-5">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: .35 }} className="space-y-5">
            {list[tab].map((m, i) => <Reveal key={`${m.id ?? ""}${m.q}`} delay={i * .06}><MarketCard m={m} idx={`${tab}-${i}`} /></Reveal>)}
            {list[tab].length === 0 && <div className="rounded-[32px] bg-surface p-10 text-center text-muted">no open markets here yet.</div>}
          </motion.div>
        </AnimatePresence>
      </div>
      <p className="mt-6 font-mono text-[11px] text-muted">payout = your stake after 0.2% fee × (total pool incl. you) ÷ (your side&apos;s pool incl. you) · {cata ? "$cata pools are live" : "$cata pools open after activation"}{list === markets ? " · sample markets" : ""}</p>
    </Page>
  );
}
