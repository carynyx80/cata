"use client";
import { Slab } from "@/components/Slab";
import { Reveal } from "@/components/Reveal";
import { Page, PageHead, SoonBanner, btn } from "@/components/ui";
import { cards, fmt } from "@/lib/data";

const grails = [[cards[4], 10000, 6120], [cards[6], 5000, 4410], [cards[0], 2000, 380]] as const;

export default function Fractional() {
  return (
    <Page>
      <SoonBanner />
      <PageHead kicker="fractional" title="own a piece of a grail." sub="big slabs split into shares. buy a slice of a pikachu illustrator for the price of a pack." />
      <div className="mt-12 grid gap-5 opacity-60 grayscale-[.4] md:grid-cols-3">
        {grails.map(([c, shares, sold], i) => (
          <Reveal key={c.id} delay={i * .06}>
            <div className="rounded-[32px] bg-surface p-5">
              <Slab card={c} hover={false} />
              <div className="mt-4 font-medium">{c.name}</div>
              <div className="font-mono text-xs text-muted">{fmt(c.value)} · {shares.toLocaleString("en-US")} shares · {fmt(+(c.value / shares).toFixed(2))} each</div>
              <div className="mt-3 h-1.5 rounded-full bg-cream"><div className="h-full rounded-full bg-pink" style={{ width: `${(sold / shares) * 100}%` }} /></div>
              <button disabled className={`${btn} mt-4 w-full`}>buy shares · soon</button>
            </div>
          </Reveal>
        ))}
      </div>
    </Page>
  );
}
