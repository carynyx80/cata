"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Reveal } from "@/components/Reveal";
import { Page, PageHead, PayToggle, Toggle, input, type Pay } from "@/components/ui";

const FEE = 0.002;
type Market = { q: string; close: string; outcomes: { name: string; pool: number }[] };
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
  const total = m.outcomes.reduce((s, o) => s + o.pool, 0);
  const s = Math.max(0, parseFloat(stake) || 0);
  const unit = cur === "bnb" ? "bnb" : "usdt";
  const scale = cur === "usdt" ? 620 : 1; // mock: usdt pools mirror bnb pools
  // parimutuel: payout = stake * (totalPool * (1 - fee)) / (outcomePool + stake)
  const shown = s > 0 ? (s * (total * scale * (1 - FEE))) / (m.outcomes[pick].pool * scale + s) : 0;
  return (
    <div className="grid gap-6 rounded-[32px] bg-surface p-6 md:p-8 lg:grid-cols-[1.3fr_1fr]">
      <div>
        <div className="font-mono text-[11px] text-muted">{m.close}</div>
        <h3 className="mt-2 font-display text-2xl leading-tight">{m.q}</h3>
        <div className="mt-5 space-y-2.5">
          {m.outcomes.map((o, i) => {
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
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted">bet on <span className="text-ink">{m.outcomes[pick].name}</span></div>
        <div className="mt-3"><PayToggle value={cur} onChange={setCur} id={`pp-${idx}`} size="sm" /></div>
        <label className="mt-4 block font-mono text-[10px] uppercase tracking-widest text-muted">stake ({unit})</label>
        <input value={stake} onChange={(e) => setStake(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" className={`${input} mt-1.5 bg-surface text-lg`} />
        <div className="mt-4 flex items-end justify-between font-mono">
          <span className="text-xs text-muted">est. payout</span>
          <span className="text-2xl">{shown.toLocaleString("en-US", { maximumFractionDigits: 3 })} {unit}</span>
        </div>
        <div className="mt-1 text-right font-mono text-[10px] text-muted">{s > 0 ? `${(shown / s).toFixed(2)}× · ` : ""}after 0.2% fee · moves as pools change</div>
        <button disabled={s <= 0} className="mt-5 w-full rounded-full bg-pink py-3 font-medium text-surface transition hover:bg-deep disabled:opacity-40">place bet</button>
      </div>
    </div>
  );
}

export default function Predict() {
  const [tab, setTab] = useState<(typeof tabs)[number]>("live rips");
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
            {markets[tab].map((m, i) => <Reveal key={m.q} delay={i * .06}><MarketCard m={m} idx={`${tab}-${i}`} /></Reveal>)}
          </motion.div>
        </AnimatePresence>
      </div>
      <p className="mt-6 font-mono text-[11px] text-muted">payout = stake × (total pool × (1 − 0.002)) ÷ (outcome pool + stake) · $cata pools open after activation</p>
    </Page>
  );
}
