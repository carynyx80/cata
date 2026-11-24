"use client";
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

export default function Live() {
  const now = sessions[0];
  return (
    <Page>
      <PageHead kicker="live rips" title="sealed, opened live." sub="buy a spot on-chain, watch the box get ripped on stream, get what lands in your spot." />
      <div className="mt-12 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Reveal>
          <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-[32px] bg-ink text-surface">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(226,72,127,.35),transparent_60%)]" />
            <span className="absolute left-5 top-5 flex items-center gap-2 rounded-full bg-pink px-3 py-1 font-mono text-[10px] uppercase tracking-widest"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-surface" /> live · 1,204 watching</span>
            <div className="relative text-center"><div className="font-display text-3xl">{now.t}</div><div className="mt-2 font-mono text-xs text-surface/60">stream placeholder · hosted by {now.host}</div></div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-[28px] bg-surface p-5">
            <div className="font-mono text-sm"><span className="text-pink">{now.spots}</span> of {now.of} spots left · {fmt(now.price)} / spot</div>
            <button className={btnPink}>buy a spot</button>
          </div>
        </Reveal>
        <Reveal delay={.06}>
          <div className="h-full rounded-[32px] bg-surface p-6">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted">recent pulls</div>
            <div className="mt-4 space-y-2">
              {pulls.map(([w, c, v]) => (
                <div key={c} className="flex items-center justify-between gap-3 rounded-2xl bg-cream px-4 py-3">
                  <div className="min-w-0"><div className="truncate text-sm font-medium">{c}</div><div className="font-mono text-[10px] text-muted">{w}</div></div>
                  <div className="font-mono text-sm">{fmt(v)}</div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
      <section className="mt-16">
        <Reveal><h2 className="font-display text-[clamp(2rem,4vw,3rem)] leading-[1]">upcoming.</h2></Reveal>
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {sessions.map((s, i) => (
            <Reveal key={s.t} delay={i * .05}>
              <div className={`h-full rounded-[32px] p-6 transition hover:-translate-y-1 ${s.live ? "bg-pink text-surface" : "bg-surface"}`}>
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
    </Page>
  );
}
