"use client";
import { useEffect, useId, useState, type KeyboardEvent } from "react";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "framer-motion";
import { Reveal } from "@/components/Reveal";
import { useQuery } from "@tanstack/react-query";
import { useConfig } from "wagmi";
import { readContract } from "wagmi/actions";
import { formatUnits, parseUnits, type Abi, type Address } from "viem";
import { Page, PageHead, PayToggle, input, type Pay } from "@/components/ui";
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
type Tab = (typeof tabs)[number];
/** page-level a11y + responsive helpers (scoped here so shared components stay untouched) */
const shell = "[&_:focus-visible]:outline-2 [&_:focus-visible]:outline-offset-2 [&_:focus-visible]:outline-pink [&_h1]:text-[clamp(2.25rem,9vw,6rem)] [&_h1]:text-balance";
const tapTargets = "pointer-coarse:[&_button]:min-h-11";

/** Market tabs: a real tablist that scrolls sideways when it doesn't fit. */
function Tabs({ value, onChange }: { value: Tab; onChange: (t: Tab) => void }) {
  const reduce = useReducedMotion();
  const onKey = (e: KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = tabs[(i + d + tabs.length) % tabs.length];
    onChange(next);
    document.getElementById(`ptab-${next.replace(/\s/g, "-")}`)?.focus();
  };
  return (
    <div className="-mx-4 max-w-[100vw] overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
      <div role="tablist" aria-label="market type" className="inline-flex rounded-full bg-surface p-1 font-mono text-sm">
        {tabs.map((t, i) => (
          <button key={t} id={`ptab-${t.replace(/\s/g, "-")}`} type="button" role="tab" aria-selected={value === t} aria-controls="ptab-panel" tabIndex={value === t ? 0 : -1}
            onClick={() => onChange(t)} onKeyDown={(e) => onKey(e, i)}
            className={`relative min-h-11 shrink-0 whitespace-nowrap rounded-full px-5 transition ${value === t ? "text-surface" : "text-muted hover:text-ink"}`}>
            {value === t && <motion.span layoutId="ptab" className="absolute inset-0 rounded-full bg-ink" transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 30 }} />}
            <span className="relative">{t}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
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
  const reduce = useReducedMotion();
  const stakeId = useId();
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
    <div className="grid gap-5 rounded-[28px] bg-surface p-4 sm:gap-6 sm:rounded-[32px] sm:p-6 md:p-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)] lg:items-start xl:gap-8">
      <div className="min-w-0">
        <div className="font-mono text-[11px] text-muted">{m.close}</div>
        <h3 className="mt-2 font-display text-[clamp(1.25rem,4.5vw,1.6rem)] leading-tight [overflow-wrap:anywhere]">{m.q}</h3>
        <div className="mt-5 space-y-2.5" role="group" aria-label="pick an outcome">
          {outcomes.map((o, i) => {
            const odds = (o.pool / total) * 100;
            return (
              <button key={o.name} type="button" onClick={() => setPick(i)} aria-pressed={pick === i}
                className={`block min-h-11 w-full rounded-2xl p-3.5 text-left transition ${pick === i ? "bg-ink text-surface" : "bg-cream hover:bg-soft/60"}`}>
                <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-[15px]"><span className="font-medium">{o.name}</span>
                  <span className="font-mono text-sm">{odds.toFixed(0)}% · {(o.pool * scale).toLocaleString("en-US", { maximumFractionDigits: 1 })} {unit}</span></div>
                <div className={`mt-2.5 h-1.5 rounded-full ${pick === i ? "bg-surface/15" : "bg-ink/10"}`}>
                  <motion.div className="h-full rounded-full bg-pink" initial={{ width: 0 }} whileInView={{ width: `${odds}%` }} viewport={{ once: true }} transition={reduce ? { duration: 0 } : { duration: .8, ease: [0.22, 1, 0.36, 1] }} />
                </div>
              </button>
            );
          })}
        </div>
        <div className="mt-3 font-mono text-[11px] text-muted">total pool {(total * scale).toLocaleString("en-US", { maximumFractionDigits: 1 })} {unit} · implied odds = share of pool</div>
      </div>
      <div className="min-w-0 rounded-3xl bg-cream p-4 sm:p-5">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted">bet on <span className="text-ink">{outcomes[pick].name}</span></div>
        <div className={`mt-3 ${tapTargets}`} role="group" aria-label="currency"><PayToggle value={cur} onChange={setCur} id={`pp-${idx}`} size="sm" /></div>
        <label htmlFor={stakeId} className="mt-4 block font-mono text-[10px] uppercase tracking-widest text-muted">stake ({unit})</label>
        <input id={stakeId} value={stake} onChange={(e) => setStake(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" autoComplete="off" enterKeyHint="done" className={`${input} mt-1.5 min-h-12 bg-surface !text-lg`} />
        <div className="mt-4 flex flex-wrap items-end justify-between gap-x-3 font-mono" aria-live="polite">
          <span className="text-xs text-muted">est. payout</span>
          <span className="min-w-0 text-[clamp(1.25rem,5vw,1.5rem)] [overflow-wrap:anywhere]">{shown.toLocaleString("en-US", { maximumFractionDigits: 3 })} {unit}</span>
        </div>
        <div className="mt-1 text-right font-mono text-[10px] text-muted">{s > 0 ? `${(shown / s).toFixed(2)}× · ` : ""}after 0.2% fee · moves as pools change</div>
        <Act need={["prediction"]} onClick={placeBet} busy={busy} busyLabel="placing…" disabled={s <= 0 || !onchain || m.status !== 0 || !token}
          soonLabel="markets launching soon" className="mt-5 min-h-12 w-full rounded-full bg-pink py-3 font-medium text-surface transition hover:bg-deep disabled:opacity-40">place bet</Act>
        {claimable > 0n && (
          <button type="button" onClick={claim} disabled={busy} className="mt-2 min-h-12 w-full rounded-full bg-ink py-3 font-medium text-surface transition hover:bg-deep">
            claim {Number(formatUnits(claimable, 18)).toLocaleString("en-US", { maximumFractionDigits: 4 })} {unit}
          </button>
        )}
      </div>
    </div>
  );
}

export default function Predict() {
  const [tab, setTab] = useState<Tab>("live rips");
  const { token: cata } = useCata();
  const chain = useChainMarkets(cata);
  const list = chain.data && Object.values(chain.data).some((l) => l.length) ? chain.data : markets;
  return (
    <MotionConfig reducedMotion="user"><div className={shell}><Page>
      <PageHead kicker="prediction markets" title="bet on the rip." sub="parimutuel pools. winners split the pot, pro rata. no house edge beyond the 0.2% burn." />
      <div className="mt-8 flex flex-wrap items-center gap-3 sm:gap-4">
        <Tabs value={tab} onChange={setTab} />
        <span className="rounded-2xl border border-ink/15 px-4 py-2 font-mono text-[11px] text-muted sm:rounded-full">only bet what you can lose. markets settle on-chain.</span>
      </div>
      <div id="ptab-panel" role="tabpanel" aria-labelledby={`ptab-${tab.replace(/\s/g, "-")}`} className="mt-6 min-h-[420px] space-y-5 sm:mt-8">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: .35 }} className="space-y-5">
            {list[tab].map((m, i) => <Reveal key={`${m.id ?? ""}${m.q}`} delay={i * .06} className="min-w-0"><MarketCard m={m} idx={`${tab}-${i}`} /></Reveal>)}
            {list[tab].length === 0 && <div className="rounded-[32px] bg-surface p-10 text-center text-muted">no open markets here yet.</div>}
          </motion.div>
        </AnimatePresence>
      </div>
      <p className="mt-6 font-mono text-[11px] text-muted">payout = your stake after 0.2% fee × (total pool incl. you) ÷ (your side&apos;s pool incl. you) · {cata ? "$cata pools are live" : "$cata pools open after activation"}{list === markets ? " · sample markets" : ""}</p>
    </Page></div></MotionConfig>
  );
}
