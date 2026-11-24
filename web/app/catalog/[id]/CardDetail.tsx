"use client";
import Link from "next/link";
import { Slab } from "@/components/Slab";
import { Reveal } from "@/components/Reveal";
import { PriceChart } from "@/components/PriceChart";
import { Page, WantButton, btnPink, btnLine } from "@/components/ui";
import { fmt, type CatalogCard } from "@/lib/data";

export function CardDetail({ c }: { c: CatalogCard }) {
  const first = c.history[0], last = c.history[c.history.length - 1];
  const chg = ((last - first) / first) * 100;
  const grades = [["raw", c.raw], ["psa 8", Math.round(c.psa9 * .55)], ["psa 9", c.psa9], ["psa 10", c.psa10], ["bgs 9.5", Math.round(c.psa10 * .72)], ["cgc 10", Math.round(c.psa10 * .6)]] as const;
  return (
    <Page>
      <Link href="/catalog" className="font-mono text-xs text-muted hover:text-pink">← catalog</Link>
      <div className="mt-6 grid gap-10 lg:grid-cols-[360px_1fr]">
        <Reveal><div className="mx-auto w-full max-w-[320px]"><Slab card={c} /></div></Reveal>
        <div>
          <Reveal>
            <p className="font-mono text-xs uppercase tracking-[.2em] text-pink">{c.game} · {c.set}</p>
            <h1 className="mt-3 font-display text-[clamp(2.2rem,5vw,4rem)] leading-[1]">{c.name}</h1>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <WantButton count={c.wants} />
              {c.inVault && <span className="rounded-full bg-ink px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-surface">in vault</span>}
            </div>
          </Reveal>
          <Reveal delay={.05}>
            <div className="mt-8 rounded-[32px] bg-surface p-6">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted">{c.grader} {c.grade} · last 12 months</div>
                  <div className="mt-1 font-mono text-3xl">{fmt(last)}</div>
                </div>
                <div className={`font-mono text-sm ${chg >= 0 ? "text-deep" : "text-muted"}`}>{chg >= 0 ? "▲" : "▼"} {Math.abs(chg).toFixed(1)}% · 12m</div>
              </div>
              <div className="mt-4"><PriceChart data={c.history} /></div>
            </div>
          </Reveal>
          <Reveal delay={.1}>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {grades.map(([k, v]) => (
                <div key={k} className="rounded-3xl bg-surface px-5 py-4">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted">{k}</div>
                  <div className="mt-1 font-mono text-xl">{fmt(v)}</div>
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/packs" className={btnPink}>open packs with this card →</Link>
              <Link href="/market" className={btnLine}>find it on the market</Link>
            </div>
            <p className="mt-4 font-mono text-[11px] text-muted">prices from the cata price index · sample data</p>
          </Reveal>
        </div>
      </div>
    </Page>
  );
}
