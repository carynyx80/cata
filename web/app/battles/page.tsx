"use client";
import { MotionConfig } from "framer-motion";
import { Slab } from "@/components/Slab";
import { Reveal } from "@/components/Reveal";
import { Page, PageHead, SoonBanner, btnPink } from "@/components/ui";
import { cards, fmt } from "@/lib/data";

const battles = [[cards[0], cards[1], "collector", 2], [cards[3], cards[2], "starter", 4], [cards[6], cards[5], "grail", 2]] as const;

/** page-level a11y + responsive helpers (scoped here so shared components stay untouched) */
const shell = "[&_:focus-visible]:outline-2 [&_:focus-visible]:outline-offset-2 [&_:focus-visible]:outline-pink [&_h1]:text-[clamp(2.25rem,9vw,6rem)] [&_h1]:text-balance";

export default function Battles() {
  return (
    <MotionConfig reducedMotion="user"><div className={`${shell} [&>div>div:first-child]:rounded-2xl sm:[&>div>div:first-child]:rounded-full`}><Page>
      <SoonBanner />
      <PageHead kicker="pack battles" title="rip head to head." sub="everyone opens the same pack. highest total pull value takes every card." />
      <div className="mt-10 grid gap-4 opacity-60 grayscale-[.4] sm:mt-12 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
        {battles.map(([a, b, tier, n], i) => (
          <Reveal key={i} delay={i * .06} className="min-w-0">
            <div className="mx-auto w-full max-w-md rounded-[28px] bg-surface p-5 sm:rounded-[32px] sm:p-6 md:max-w-none">
              <div className="flex flex-wrap justify-between gap-x-3 font-mono text-[11px] text-muted"><span>{tier} · {n} players</span><span>pot {fmt(a.value + b.value)}</span></div>
              <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3">
                <Slab card={a} hover={false} className="!border-[3px] !p-1.5" />
                <span className="font-display text-xl text-pink" aria-label="versus">vs</span>
                <Slab card={b} hover={false} className="!border-[3px] !p-1.5" />
              </div>
              <button disabled className={`${btnPink} mt-5 w-full`}>join battle · soon</button>
            </div>
          </Reveal>
        ))}
      </div>
    </Page></div></MotionConfig>
  );
}
