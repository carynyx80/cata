"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Slab } from "@/components/Slab";
import { Reveal } from "@/components/Reveal";
import { cards, fmt } from "@/lib/data";

const tiers = [
  { name: "starter", price: 25, tone: "bg-surface", odds: [["$10–25", "62%"], ["$25–75", "28%"], ["$75–250", "8.5%"], ["$250+", "1.5%"]], left: 412 },
  { name: "collector", price: 50, tone: "bg-soft", odds: [["$25–50", "55%"], ["$50–150", "32%"], ["$150–500", "11%"], ["$500+", "2%"]], left: 238, hot: true },
  { name: "grail", price: 250, tone: "bg-ink text-surface", odds: [["$150–250", "48%"], ["$250–750", "35%"], ["$750–2.5k", "14%"], ["$2.5k+", "3%"]], left: 57 },
];
const pays = ["bnb", "usdt", "$cata"] as const;

export default function Packs() {
  const [pay, setPay] = useState<(typeof pays)[number]>("bnb");
  return (
    <div className="mx-auto max-w-7xl px-4 pt-16 md:px-8">
      <Reveal>
        <p className="font-mono text-xs uppercase tracking-[.2em] text-pink">packs</p>
        <h1 className="mt-4 font-display text-[clamp(2.8rem,7vw,6rem)] leading-[.95]">pick your rip.</h1>
        <p className="mt-5 max-w-xl text-xl text-muted">published odds. public pools. every pull settled by chainlink vrf. don&apos;t love it? sell it back for 85%.</p>
      </Reveal>

      <div className="mt-10 inline-flex rounded-full bg-surface p-1.5 font-mono text-sm">
        {pays.map((p) => {
          const soon = p === "$cata";
          return (
            <button key={p} disabled={soon} onClick={() => setPay(p)}
              className={`relative rounded-full px-5 py-2 transition ${soon ? "cursor-not-allowed text-muted/50" : "hover:text-ink"} ${pay === p ? "text-surface" : "text-muted"}`}>
              {pay === p && <motion.span layoutId="pay" className="absolute inset-0 rounded-full bg-ink" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
              <span className="relative">{p}{soon && <span className="ml-1.5 text-[10px]">soon</span>}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        {tiers.map((t, i) => (
          <Reveal key={t.name} delay={i * .08}>
            <div className={`group relative h-full rounded-[36px] p-8 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_40px_70px_-35px_rgba(43,26,34,.5)] ${t.tone}`}>
              {t.hot && <span className="absolute right-6 top-6 rounded-full bg-pink px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-surface">most ripped</span>}
              <div className="font-mono text-xs uppercase tracking-[.2em] opacity-70">{t.name}</div>
              <div className="mt-6 font-display text-6xl">${t.price}</div>
              <div className="mt-1 font-mono text-xs opacity-60">paid in {pay} · +0.2% burn fee</div>
              <table className="mt-8 w-full font-mono text-sm">
                <thead><tr className="text-left text-[10px] uppercase tracking-widest opacity-60"><th className="pb-2 font-normal">pull value</th><th className="pb-2 text-right font-normal">odds</th></tr></thead>
                <tbody>{t.odds.map(([v, o]) => (
                  <tr key={v} className="border-t border-current/10"><td className="py-2.5">{v}</td><td className="py-2.5 text-right">{o}</td></tr>
                ))}</tbody>
              </table>
              <div className="mt-6 font-mono text-xs opacity-70">{t.left} cards left in pool</div>
              <button className={`mt-6 w-full rounded-full py-4 text-lg font-medium transition ${t.name === "grail" ? "bg-pink text-surface hover:bg-surface hover:text-ink" : "bg-ink text-surface hover:bg-pink"}`}>
                open {t.name} pack
              </button>
            </div>
          </Reveal>
        ))}
      </div>

      <section className="mt-24">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[.2em] text-pink">glass pack · collector pool</p>
              <h2 className="mt-3 font-display text-[clamp(2rem,4.5vw,3.5rem)] leading-[1]">what&apos;s still inside.</h2>
            </div>
            <div className="font-mono text-sm text-muted">238 left · 762 pulled · pool value {fmt(48210)}</div>
          </div>
        </Reveal>
        <div className="mt-10 grid grid-cols-2 gap-5 sm:grid-cols-4 lg:grid-cols-8">
          {cards.map((c, i) => (
            <Reveal key={c.id} delay={i * .04}>
              <Slab card={c} className="!border-[4px] !p-2" />
              <div className="mt-3 flex justify-between font-mono text-[11px]"><span className="text-muted">×{(i * 7) % 13 + 1} left</span><span>{fmt(c.value)}</span></div>
            </Reveal>
          ))}
        </div>
      </section>
    </div>
  );
}
