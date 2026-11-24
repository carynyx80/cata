"use client";
import { MotionConfig } from "framer-motion";
import { Slab } from "@/components/Slab";
import { Reveal } from "@/components/Reveal";
import { Page, PageHead, SoonBanner, btn } from "@/components/ui";
import { cards, fmt } from "@/lib/data";

const grails = [[cards[4], 10000, 6120], [cards[6], 5000, 4410], [cards[0], 2000, 380]] as const;

/** page-level a11y + responsive helpers (scoped here so shared components stay untouched) */
const shell = "[&_:focus-visible]:outline-2 [&_:focus-visible]:outline-offset-2 [&_:focus-visible]:outline-pink [&_h1]:text-[clamp(2.25rem,9vw,6rem)] [&_h1]:text-balance";

export default function Fractional() {
  return (
    <MotionConfig reducedMotion="user"><div className={`${shell} [&>div>div:first-child]:rounded-2xl sm:[&>div>div:first-child]:rounded-full`}><Page>
      <SoonBanner />
      <PageHead kicker="fractional" title="own a piece of a grail." sub="big slabs split into shares. buy a slice of a pikachu illustrator for the price of a pack." />
      <div className="mt-10 grid gap-4 opacity-60 grayscale-[.4] sm:mt-12 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
        {grails.map(([c, shares, sold], i) => (
          <Reveal key={c.id} delay={i * .06} className="min-w-0">
            <div className="mx-auto w-full max-w-sm rounded-[28px] bg-surface p-5 sm:max-w-none sm:rounded-[32px]">
              <Slab card={c} hover={false} />
              <div className="mt-4 font-medium">{c.name}</div>
              <div className="font-mono text-xs text-muted">{fmt(c.value)} · {shares.toLocaleString("en-US")} shares · {fmt(+(c.value / shares).toFixed(2))} each</div>
              <div className="mt-3 h-1.5 rounded-full bg-cream"><div className="h-full rounded-full bg-pink" style={{ width: `${(sold / shares) * 100}%` }} /></div>
              <button disabled className={`${btn} mt-4 w-full`}>buy shares · soon</button>
            </div>
          </Reveal>
        ))}
      </div>
    </Page></div></MotionConfig>
  );
}
