"use client";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Slab } from "@/components/Slab";
import { Reveal } from "@/components/Reveal";
import { cards, fmt } from "@/lib/data";
import { useCata } from "@/components/web3/Providers";

const fan = [
  { c: cards[1], r: -14, x: -150, y: 30, z: 1 },
  { c: cards[0], r: 0, x: 0, y: 0, z: 3 },
  { c: cards[3], r: 13, x: 150, y: 34, z: 2 },
];

const steps = [
  ["01", "buy a pack", "pay in bnb or usdt. starter, collector or grail."],
  ["02", "fair pull", "chainlink vrf picks your card. provable, on-chain, no back room."],
  ["03", "keep or sell back", "love it? vault it. not your thing? instant 85% buyback."],
  ["04", "trade or ship", "list it on the market, or burn the nft and we ship the real slab."],
];

export default function Home() {
  const { active: cataLive } = useCata();
  const still = useReducedMotion();
  return (
    <>
      {/* hero */}
      <section className="mx-auto grid max-w-7xl items-center gap-6 px-4 pb-16 pt-10 sm:gap-12 sm:pt-16 md:px-8 lg:grid-cols-[1.1fr_1fr] lg:pb-24 lg:pt-20 2xl:pt-24">
        <div className="min-w-0">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5 }}
            className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-surface px-3 py-1 font-mono text-[11px] text-muted">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-pink" /> graded cards, on-chain, redeemable
          </motion.div>
          <h1 className="mt-6 font-display text-[clamp(2.6rem,11.5vw,4.6rem)] leading-[.92] tracking-[-.01em] [text-wrap:wrap] lg:text-[clamp(4rem,6.2vw,6.4rem)]">
            {["pull", "something"].map((w, i) => (
              <motion.span key={w} className="mr-[.25em] inline-block" initial={{ y: 24 }} animate={{ y: 0 }}
                transition={{ duration: .8, delay: .1 + i * .1, ease: [0.22, 1, 0.36, 1] }}>{w}</motion.span>
            ))}
            <motion.span className="inline-block text-pink" initial={{ y: 24 }} animate={{ y: 0 }}
              transition={{ duration: .8, delay: .3, ease: [0.22, 1, 0.36, 1] }}>real.</motion.span>
          </h1>
          <motion.p initial={{ y: 8 }} animate={{ y: 0 }} transition={{ delay: .3, duration: .6 }}
            className="mt-5 max-w-md text-lg text-muted sm:mt-6 sm:text-xl md:text-2xl">rip it. flip it. bet on it. borrow on it. ship it.</motion.p>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .6, duration: .6 }}
            className="mt-8 flex flex-wrap gap-3 sm:mt-10">
            <Link href="/packs" className="group inline-flex min-h-12 items-center rounded-full bg-pink px-6 py-3 text-base font-medium text-surface sm:px-7 sm:py-4 sm:text-lg shadow-[0_12px_30px_-10px_#E2487F] transition-all hover:-translate-y-0.5 hover:bg-deep">
              open a pack <span aria-hidden className="ml-1.5 inline-block transition-transform group-hover:translate-x-1">→</span>
            </Link>
            <Link href="/catalog" className="inline-flex min-h-12 items-center rounded-full border-2 border-ink px-6 py-3 text-base font-medium transition-all sm:px-7 sm:py-4 sm:text-lg hover:-translate-y-0.5 hover:bg-ink hover:text-surface">
              browse every card
            </Link>
          </motion.div>
          <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 font-mono text-sm sm:mt-12 sm:flex sm:gap-10">
            {[["every card", "4 games + sports"], ["85%", "instant buyback"], ["0.2%", "to $cata burn"]].map(([n, l]) => (
              <div key={l}><div className="text-lg text-ink sm:text-2xl">{n}</div><div className="text-xs text-muted">{l}</div></div>
            ))}
          </div>
        </div>
        <div aria-hidden className="relative mx-auto h-[250px] w-full max-w-[520px] min-[400px]:h-[280px] sm:h-[400px] lg:h-[480px] xl:h-[520px]">
          <div className="absolute left-1/2 top-0 h-[520px] w-[520px] -translate-x-1/2 origin-top scale-[.56] min-[400px]:scale-[.64] sm:scale-[.86] lg:scale-[.92] xl:scale-100">
            <div className="absolute inset-10 rounded-full bg-soft blur-3xl" />
            {fan.map(({ c, r, x, y, z }, i) => (
              <motion.div key={c.id} className="absolute left-[calc(50%-115px)] top-4 w-[230px]" style={{ zIndex: z }}
                initial={{ opacity: 0, y: 120, rotate: 0, x: 0 }}
                animate={{ opacity: 1, y, rotate: r, x }}
                transition={{ type: "spring", stiffness: 70, damping: 14, delay: .3 + i * .12 }}>
                <Slab card={c} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* marquee */}
      <div aria-hidden className="overflow-hidden border-y border-ink/10 bg-ink py-3 text-surface sm:py-4">
        <motion.div className="flex w-max gap-8 whitespace-nowrap font-display text-xl sm:gap-12 sm:text-2xl" animate={still ? undefined : { x: ["0%", "-50%"] }} transition={{ repeat: Infinity, duration: 30, ease: "linear" }}>
          {[...Array(2)].flatMap((_, k) => ["pokémon", "one piece", "magic", "yu-gi-oh", "basketball", "baseball", "football"].map((t) => (
            <span key={t + k} className="flex items-center gap-8 sm:gap-12">{t}<span className="text-pink">✦</span></span>
          )))}
        </motion.div>
      </div>

      {/* how it works */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:py-28 md:px-8">
        <Reveal><p className="font-mono text-xs uppercase tracking-[.2em] text-pink">how it works</p></Reveal>
        <Reveal delay={.05}><h2 className="mt-4 max-w-3xl font-display text-[clamp(2.2rem,5vw,4rem)] leading-[1]">four steps from rip to real.</h2></Reveal>
        <div className="mt-10 grid gap-4 sm:mt-14 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(([n, t, d], i) => (
            <Reveal key={n} delay={i * .08}>
              <div className="group h-full rounded-[28px] bg-surface p-6 transition-all sm:p-7 duration-300 hover:-translate-y-1.5 hover:shadow-[0_30px_60px_-30px_rgba(43,26,34,.35)]">
                <div className="font-mono text-sm text-pink">{n}</div>
                <h3 className="mt-6 font-display text-2xl sm:mt-10">{t}</h3>
                <p className="mt-3 text-muted">{d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* glass packs */}
      <section className="mx-auto max-w-7xl px-4 md:px-8">
        <Reveal>
          <div className="grid items-center gap-8 overflow-hidden rounded-[32px] bg-soft p-6 sm:gap-10 sm:rounded-[40px] sm:p-8 md:p-14 lg:grid-cols-2">
            <div>
              <p className="font-mono text-xs uppercase tracking-[.2em] text-deep">glass packs</p>
              <h2 className="mt-4 font-display text-[clamp(2.2rem,5vw,4rem)] leading-[1]">see every card left in the pool.</h2>
              <p className="mt-5 max-w-md text-lg text-muted">pack pools are public. before you rip, you know exactly what&apos;s still inside — and what&apos;s already gone.</p>
              <Link href="/packs" className="mt-8 inline-flex min-h-12 items-center rounded-full bg-ink px-6 py-3 text-surface transition hover:bg-deep">look inside →</Link>
            </div>
            <div aria-hidden className="grid grid-cols-4 gap-2 sm:gap-3">
              {cards.slice(0, 8).map((c, i) => (
                <motion.div key={c.id} initial={{ opacity: 0, scale: .9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * .05 }}
                  className={i === 2 || i === 5 ? "opacity-30 grayscale" : ""}>
                  <Slab card={c} hover={false} className="!rounded-[14px] !border-[3px] !p-1 sm:!rounded-[22px] sm:!p-1.5 [&>div:first-child]:!px-1.5 [&>div:first-child]:!py-1 max-sm:[&>div:first-child_.font-display]:!text-base max-sm:[&>div:first-child_.font-mono]:hidden max-sm:[&>div:last-child]:!mt-1 max-sm:[&>div:last-child]:!h-[calc(100%-2rem)]" />
                </motion.div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* predict + borrow */}
      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-4 md:px-8 lg:grid-cols-2">
        <Reveal>
          <div className="h-full rounded-[32px] bg-ink p-6 text-surface sm:rounded-[40px] sm:p-8 md:p-12">
            <p className="font-mono text-xs uppercase tracking-[.2em] text-soft">prediction markets</p>
            <h2 className="mt-4 font-display text-[clamp(2rem,4vw,3.2rem)] leading-[1]">bet on the rip.</h2>
            <p className="mt-4 max-w-md text-surface/70">parimutuel pools on live rips, pack pools and card prices. bnb, usdt — and {cataLive ? "$cata." : "$cata soon."}</p>
            <div className="mt-8 space-y-3">
              {[["charizard pulled from grail pool this week?", 62], ["umbreon alt art psa 10 above $1,800 by dec 31?", 38]].map(([q, p]) => (
                <div key={q as string} className="rounded-2xl bg-surface/5 p-4 transition hover:bg-surface/10">
                  <div className="flex justify-between gap-4 text-[15px] sm:text-sm"><span>{q}</span><span className="shrink-0 font-mono text-pink">{p}% yes</span></div>
                  <div className="mt-3 h-1.5 rounded-full bg-surface/10"><div className="h-full rounded-full bg-pink" style={{ width: `${p}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
        <Reveal delay={.08}>
          <div className="h-full rounded-[32px] bg-surface p-6 sm:rounded-[40px] sm:p-8 md:p-12">
            <p className="font-mono text-xs uppercase tracking-[.2em] text-pink">borrow</p>
            <h2 className="mt-4 font-display text-[clamp(2rem,4vw,3.2rem)] leading-[1]">your cards, as collateral.</h2>
            <p className="mt-4 max-w-md text-muted">borrow usdt or bnb against vaulted slabs. keep the card, unlock the cash.</p>
            <div className="mt-8 flex items-end gap-4 rounded-3xl bg-cream p-4 sm:gap-5 sm:p-5">
              <div className="w-20 shrink-0 sm:w-24"><Slab card={cards[0]} hover={false} className="!border-[3px] !p-1.5" /></div>
              <div className="min-w-0 font-mono text-sm">
                <div className="text-muted">value {fmt(cards[0].value)}</div>
                <div className="mt-1 text-2xl text-ink sm:text-3xl">{fmt(cards[0].value * 0.4)}</div>
                <div className="text-[11px] text-muted">available · 40% ltv</div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* $cata */}
      <section className="mx-auto max-w-7xl px-4 pt-16 sm:pt-24 md:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-[32px] bg-pink p-6 text-surface sm:rounded-[40px] sm:p-10 md:p-16">
            <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-deep blur-2xl" />
            <div className="relative grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-end">
              <div>
                <p className="font-mono text-xs uppercase tracking-[.2em] text-soft">{cataLive ? "$cata · live" : "$cata · coming soon"}</p>
                <h2 className="mt-4 font-display text-[clamp(2.2rem,8vw,5rem)] leading-[.95]">every move burns.</h2>
                <p className="mt-5 max-w-lg text-lg text-surface/85">0.2% of every transaction on cata — packs, trades, loans, bets — goes to a treasury that buys back $cata on pancakeswap and sends it to the dead address. no team cut.</p>
              </div>
              <div className="rounded-3xl bg-surface/10 p-6 font-mono text-sm backdrop-blur">
                {[["fee", "0.2%"], ["to buyback", "100%"], ["burned to", "0x…dEaD"], ["status", "fees accruing"]].map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-surface/15 py-2.5 last:border-0"><span className="text-surface/70">{k}</span><span>{v}</span></div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
