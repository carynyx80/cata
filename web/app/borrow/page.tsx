"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Slab } from "@/components/Slab";
import { Reveal } from "@/components/Reveal";
import { Page, PageHead, Toggle, input, btnPink, btn } from "@/components/ui";
import { catalog, fmt } from "@/lib/data";

const vaulted = catalog.filter((c) => c.inVault);
const LTV = 0.4, LIQ = 0.6, APR = 0.15, BNB = 620;
const assets = ["usdt", "bnb"] as const;

export default function Borrow() {
  const [sel, setSel] = useState(vaulted[0].id);
  const [asset, setAsset] = useState<(typeof assets)[number]>("usdt");
  const [amt, setAmt] = useState("");
  const c = vaulted.find((v) => v.id === sel)!;
  const max = c.value * LTV;
  const want = Math.min(max, Math.max(0, parseFloat(amt) || 0) * (asset === "bnb" ? BNB : 1));
  const used = want / c.value;
  const liqAt = want > 0 ? want / LIQ : 0;
  const show = (usd: number) => asset === "bnb" ? `${(usd / BNB).toFixed(3)} bnb` : `${Math.round(usd).toLocaleString("en-US")} usdt`;
  return (
    <Page>
      <PageHead kicker="borrow" title="your cards, as collateral." sub="lock a vaulted slab, borrow usdt or bnb. repay any time and the card is yours again." />
      <div className="mt-12 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Reveal>
          <div className="rounded-[32px] bg-surface p-6">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted">1 · pick a vaulted slab</div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {vaulted.map((v) => (
                <button key={v.id} onClick={() => { setSel(v.id); setAmt(""); }}
                  className={`rounded-3xl p-2 text-left transition ${sel === v.id ? "bg-soft ring-2 ring-pink" : "bg-cream hover:bg-soft/50"}`}>
                  <Slab card={v} hover={false} className="!border-[3px] !p-1.5" />
                  <div className="mt-2 truncate px-1 text-xs font-medium">{v.name}</div>
                  <div className="px-1 font-mono text-[11px] text-muted">{fmt(v.value)}</div>
                </button>
              ))}
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[["collateral value", fmt(c.value)], ["max loan · 40% ltv", fmt(max)], ["apr", "15%"]].map(([k, v]) => (
                <div key={k} className="rounded-3xl bg-cream px-5 py-4"><div className="font-mono text-[10px] uppercase tracking-widest text-muted">{k}</div><div className="mt-1 font-mono text-2xl">{v}</div></div>
              ))}
            </div>
          </div>
        </Reveal>
        <Reveal delay={.06}>
          <div className="h-full rounded-[32px] bg-ink p-6 text-surface">
            <div className="font-mono text-[10px] uppercase tracking-widest text-surface/60">2 · borrow</div>
            <div className="mt-4"><Toggle dark options={assets} value={asset} onChange={(a) => { setAsset(a); setAmt(""); }} id="basset" size="sm" /></div>
            <div className="mt-4 flex gap-2">
              <input value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^0-9.]/g, ""))} placeholder={`0 ${asset}`} inputMode="decimal" className={`${input} border-surface/15 bg-surface/5 text-lg text-surface`} />
              <button onClick={() => setAmt(asset === "bnb" ? (max / BNB).toFixed(3) : String(max))} className="rounded-2xl bg-surface/10 px-4 font-mono text-xs hover:bg-surface/20">max</button>
            </div>
            <div className="mt-5">
              <div className="flex justify-between font-mono text-[11px] text-surface/60"><span>loan-to-value</span><span>{(used * 100).toFixed(1)}% / 40% max · liquidation 60%</span></div>
              <div className="relative mt-2 h-2.5 rounded-full bg-surface/10">
                <motion.div className="h-full rounded-full bg-pink" animate={{ width: `${(used / LIQ) * 100}%` }} transition={{ type: "spring", stiffness: 200, damping: 30 }} />
                <div className="absolute top-[-4px] h-[18px] w-0.5 bg-surface/60" style={{ left: `${(LTV / LIQ) * 100}%` }} />
              </div>
            </div>
            <div className="mt-5 space-y-2 font-mono text-sm">
              {[["you receive", show(want)], ["interest / month", show(want * APR / 12)], ["liquidated if card value falls below", want > 0 ? fmt(Math.round(liqAt)) : "—"]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-surface/10 pb-2"><span className="text-surface/60">{k}</span><span>{v}</span></div>
              ))}
            </div>
            <button disabled={want <= 0} className={`${btnPink} mt-6 w-full`}>borrow {asset}</button>
          </div>
        </Reveal>
      </div>
      <Reveal>
        <div className="mt-5 rounded-[32px] bg-soft p-6 md:p-8">
          <h3 className="font-display text-2xl">how liquidation works, simply.</h3>
          <p className="mt-3 max-w-3xl text-muted">you can borrow up to 40% of your card&apos;s value. if the card&apos;s price drops so far that your loan is worth 60% of it, the loan can be closed: the slab is sold to repay lenders, and anything left over comes back to you. repay early or add another slab to stay safe.</p>
        </div>
      </Reveal>
      <section className="mt-20">
        <Reveal><p className="font-mono text-xs uppercase tracking-[.2em] text-pink">lend</p><h2 className="mt-3 font-display text-[clamp(2rem,4.5vw,3.5rem)] leading-[1]">supply usdt or bnb.</h2>
          <p className="mt-3 max-w-xl text-muted">earn interest from borrowers. every loan is backed by a graded slab in the vault.</p></Reveal>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {[["usdt", "9.8%", "412,300 usdt", "61%"], ["bnb", "6.4%", "318.4 bnb", "47%"]].map(([a, apy, sup, util], i) => (
            <Reveal key={a} delay={i * .06}>
              <div className="rounded-[32px] bg-surface p-6">
                <div className="flex items-baseline justify-between"><span className="font-display text-3xl">{a}</span><span className="font-mono text-3xl text-pink">{apy}<span className="ml-1 text-xs text-muted">supply apy</span></span></div>
                <div className="mt-4 grid grid-cols-2 gap-3 font-mono text-sm">
                  <div className="rounded-2xl bg-cream p-3"><div className="text-[10px] uppercase tracking-widest text-muted">supplied</div>{sup}</div>
                  <div className="rounded-2xl bg-cream p-3"><div className="text-[10px] uppercase tracking-widest text-muted">utilization</div>{util}</div>
                </div>
                <button className={`${btn} mt-5 w-full`}>supply {a}</button>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
    </Page>
  );
}
