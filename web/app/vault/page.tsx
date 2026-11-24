"use client";
import { Slab } from "@/components/Slab";
import { Reveal } from "@/components/Reveal";
import { cards, fmt } from "@/lib/data";

export default function Vault() {
  const total = cards.reduce((s, c) => s + c.value, 0);
  return (
    <div className="mx-auto max-w-7xl px-4 pt-16 md:px-8">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="font-mono text-xs uppercase tracking-[.2em] text-pink">vault</p>
            <h1 className="mt-4 font-display text-[clamp(2.8rem,7vw,6rem)] leading-[.95]">your slabs.</h1>
          </div>
          <div className="flex gap-3">
            {[["slabs", String(cards.length)], ["vault value", fmt(total)], ["borrowable", fmt(Math.round(total * .4))]].map(([k, v]) => (
              <div key={k} className="rounded-3xl bg-surface px-6 py-4">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted">{k}</div>
                <div className="mt-1 font-mono text-2xl">{v}</div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
      <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c, i) => (
          <Reveal key={c.id} delay={(i % 4) * .06}>
            <div className="rounded-[32px] bg-surface p-4 transition-shadow hover:shadow-[0_30px_60px_-30px_rgba(43,26,34,.4)]">
              <Slab card={c} />
              <div className="mt-4 px-1">
                <div className="truncate font-medium">{c.name}</div>
                <div className="flex justify-between font-mono text-xs text-muted">
                  <span>{c.grader} {c.grade} · {c.set}</span>
                </div>
                <div className="mt-2 font-mono text-xl">{fmt(c.value)}</div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                <button className="rounded-full bg-ink py-2 text-surface transition hover:bg-pink">list</button>
                <button className="rounded-full border border-ink/20 py-2 transition hover:border-ink hover:bg-cream">ship to me</button>
                <button className="rounded-full border border-ink/20 py-2 transition hover:border-ink hover:bg-cream">borrow</button>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
