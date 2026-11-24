"use client";
import { Slab } from "@/components/Slab";
import { Reveal } from "@/components/Reveal";
import { Page, PageHead, SoonBanner, btnPink } from "@/components/ui";
import { cards, fmt } from "@/lib/data";

const battles = [[cards[0], cards[1], "collector", 2], [cards[3], cards[2], "starter", 4], [cards[6], cards[5], "grail", 2]] as const;

export default function Battles() {
  return (
    <Page>
      <SoonBanner />
      <PageHead kicker="pack battles" title="rip head to head." sub="everyone opens the same pack. highest total pull value takes every card." />
      <div className="mt-12 grid gap-5 opacity-60 grayscale-[.4] lg:grid-cols-3">
        {battles.map(([a, b, tier, n], i) => (
          <Reveal key={i} delay={i * .06}>
            <div className="rounded-[32px] bg-surface p-6">
              <div className="flex justify-between font-mono text-[11px] text-muted"><span>{tier} · {n} players</span><span>pot {fmt(a.value + b.value)}</span></div>
              <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <Slab card={a} hover={false} className="!border-[3px] !p-1.5" />
                <span className="font-display text-xl text-pink">vs</span>
                <Slab card={b} hover={false} className="!border-[3px] !p-1.5" />
              </div>
              <button disabled className={`${btnPink} mt-5 w-full`}>join battle · soon</button>
            </div>
          </Reveal>
        ))}
      </div>
    </Page>
  );
}
