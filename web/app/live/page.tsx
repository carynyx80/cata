"use client";
import { MotionConfig } from "framer-motion";
import { Reveal } from "@/components/Reveal";
import { Page, PageHead, btnPink } from "@/components/ui";
import { fmt } from "@/lib/data";

const sessions = [
  { t: "evolving skies booster box", host: "rip.cata", when: "live now", live: true, spots: 4, of: 36, price: 18 },
  { t: "151 case break · 6 boxes", host: "mika_pulls", when: "tonight 19:30 utc", live: false, spots: 22, of: 60, price: 32 },
  { t: "op-05 awakening of the new era", host: "rip.cata", when: "tomorrow 18:00 utc", live: false, spots: 41, of: 48, price: 12 },
  { t: "2024 prizm basketball hobby", host: "courtside", when: "fri 01:00 utc", live: false, spots: 12, of: 30, price: 45 },
];
const pulls = [["0x91f…2a", "umbreon v alt art", 640], ["0x3c0…e1", "espeon v alt art", 38], ["0xa77…09", "charizard ex sir", 410], ["0x12d…77", "sylveon v alt art", 220], ["0x5be…4c", "rayquaza vmax alt", 360]] as const;

/** page-level a11y + responsive helpers (scoped here so shared components stay untouched) */
const shell = "[&_:focus-visible]:outline-2 [&_:focus-visible]:outline-offset-2 [&_:focus-visible]:outline-pink [&_h1]:text-[clamp(2.25rem,9vw,6rem)] [&_h1]:text-balance";

export default function Live() {
  const now = sessions[0];
  return (
    <MotionConfig reducedMotion="user"><div className={shell}><Page>
      <PageHead kicker="live rips" title="sealed, opened live." sub="buy a spot on-chain, watch the box get ripped on stream, get what lands in your spot." />
      <div className="mt-10 grid gap-5 sm:mt-12 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Reveal className="min-w-0">
          <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-[28px] bg-ink text-surface sm:rounded-[32px]" role="img" aria-label={`live stream placeholder: ${now.t}`}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(226,72,127,.35),transparent_60%)]" />
            <span className="absolute left-4 top-4 flex sm:left-5 sm:top-5 items-center gap-2 rounded-full bg-pink px-3 py-1 font-mono text-[10px] uppercase tracking-widest"><span className="h-1.5 w-1.5 rounded-full bg-surface motion-safe:animate-pulse" /> live · 1,204 watching</span>
            <div className="relative px-6 pt-6 text-center sm:pt-0"><div className="font-display text-[clamp(1.4rem,5vw,1.875rem)] leading-tight">{now.t}</div><div className="mt-2 font-mono text-xs text-surface/60">stream placeholder · hosted by {now.host}</div></div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-[28px] bg-surface p-4 sm:p-5">
            <div className="font-mono text-sm"><span className="text-pink">{now.spots}</span> of {now.of} spots left · {fmt(now.price)} / spot</div>
            <button type="button" className={`${btnPink} min-h-11 w-full sm:w-auto`}>buy a spot</button>
          </div>
        </Reveal>
        <Reveal delay={.06} className="min-w-0">
          <div className="h-full rounded-[28px] bg-surface p-5 sm:rounded-[32px] sm:p-6">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted">recent pulls</div>
            <div className="mt-4 space-y-2">
              {pulls.map(([w, c, v]) => (
                <div key={c} className="flex items-center justify-between gap-3 rounded-2xl bg-cream px-4 py-3">
                  <div className="min-w-0"><div className="truncate text-[15px] font-medium">{c}</div><div className="font-mono text-[10px] text-muted">{w}</div></div>
                  <div className="shrink-0 font-mono text-sm">{fmt(v)}</div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
      <section className="mt-14 md:mt-16">
        <Reveal><h2 className="font-display text-[clamp(2rem,4vw,3rem)] leading-[1]">upcoming.</h2></Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-4">
          {sessions.map((s, i) => (
            <Reveal key={s.t} delay={i * .05} className="min-w-0">
              <div className={`h-full rounded-[28px] p-5 transition motion-safe:hover:-translate-y-1 sm:rounded-[32px] sm:p-6 ${s.live ? "bg-pink text-surface" : "bg-surface"}`}>
                <div className="font-mono text-[11px] opacity-70">{s.when}</div>
                <div className="mt-3 font-display text-xl leading-tight">{s.t}</div>
                <div className="mt-1 font-mono text-[11px] opacity-70">by {s.host}</div>
                <div className="mt-5 h-1.5 rounded-full bg-current/15"><div className={`h-full rounded-full ${s.live ? "bg-surface" : "bg-pink"}`} style={{ width: `${((s.of - s.spots) / s.of) * 100}%` }} /></div>
                <div className="mt-2 flex justify-between font-mono text-xs"><span>{s.spots} spots left</span><span>{fmt(s.price)}</span></div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
    </Page></div></MotionConfig>
  );
}
