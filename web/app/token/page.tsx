"use client";
import { Reveal } from "@/components/Reveal";
import { useState } from "react";
import { Page } from "@/components/ui";
import { useCata } from "@/components/web3/Providers";
import { bscscanAddr, pancakeBuy } from "@/lib/contracts";

const facts = [["supply", "1,000,000,000"], ["launch", "fair launch"], ["where", "flap.sh"], ["burn", "0.2% of every tx"]];
const perks = [["discounts", "pay for packs and fees in $cata and pay less."], ["$cata betting pools", "prediction markets with $cata pools, alongside bnb and usdt."], ["early grail drops", "holders get first access to grail pools and rare drops."]];

export default function Token() {
  const { token, active } = useCata();
  const [copied, setCopied] = useState(false);
  const copy = () => { if (token) { navigator.clipboard?.writeText(token); setCopied(true); setTimeout(() => setCopied(false), 1500); } };
  return (
    <Page>
      <Reveal>
        <div className="relative overflow-hidden rounded-[40px] bg-pink p-8 text-surface md:p-16">
          <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-deep blur-2xl" />
          <div className="relative">
            <p className="font-mono text-xs uppercase tracking-[.2em] text-soft">{active ? "$cata · live on bnb chain" : "$cata · coming soon on flap.sh"}</p>
            <h1 className="mt-4 font-display text-[clamp(2.8rem,8vw,7rem)] leading-[.92]">every move burns.</h1>
            <p className="mt-6 max-w-xl text-lg text-surface/85">0.2% of every transaction on cata — packs, trades, loans, bets — buys back $cata on pancakeswap and burns it. fair launch on flap.sh.</p>
            <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
              {facts.map(([k, v]) => (
                <div key={k} className="rounded-3xl bg-surface/10 p-5 backdrop-blur"><div className="font-mono text-[10px] uppercase tracking-widest text-surface/70">{k}</div><div className="mt-1 font-mono text-lg">{v}</div></div>
              ))}
            </div>
          </div>
        </div>
      </Reveal>
      <Reveal>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-[32px] bg-surface p-6">
          <div className="min-w-0"><div className="font-mono text-[10px] uppercase tracking-widest text-muted">contract address{active && <span className="ml-2 rounded-full bg-pink px-2 py-0.5 text-[9px] text-surface">$cata live</span>}</div>
            {active ? <a href={bscscanAddr(token!)} target="_blank" rel="noreferrer" className="mt-1 block break-all font-mono text-lg text-ink hover:text-pink">{token}</a>
              : <div className="mt-1 font-mono text-lg text-muted">ca drops at launch</div>}</div>
          {active ? (
            <div className="flex flex-wrap gap-2">
              <button onClick={copy} className="rounded-full border border-ink/15 px-5 py-2.5 font-mono text-xs transition hover:border-ink">{copied ? "copied ✓" : "copy ca"}</button>
              <a href={pancakeBuy(token!)} target="_blank" rel="noreferrer" className="rounded-full bg-pink px-5 py-2.5 font-mono text-xs text-surface transition hover:bg-deep">buy on pancakeswap ↗</a>
            </div>
          ) : <button disabled className="rounded-full border border-ink/15 px-5 py-2.5 font-mono text-xs text-muted/60">copy · soon</button>}
        </div>
      </Reveal>
      <h2 className="mt-20 font-display text-[clamp(2rem,4.5vw,3.5rem)] leading-[1]">what holders get.</h2>
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {perks.map(([t, d], i) => (
          <Reveal key={t} delay={i * .06}>
            <div className="h-full rounded-[32px] bg-surface p-7 transition hover:-translate-y-1.5"><div className="font-mono text-sm text-pink">0{i + 1}</div><h3 className="mt-8 font-display text-2xl">{t}</h3><p className="mt-3 text-muted">{d}</p></div>
          </Reveal>
        ))}
      </div>
      <Reveal>
        <div className="mt-5 rounded-[32px] bg-ink p-7 text-surface md:p-10">
          <h3 className="font-display text-2xl">how the burn works.</h3>
          <ol className="mt-4 grid gap-4 font-mono text-sm text-surface/75 md:grid-cols-3">
            <li>1 · every tx pays 0.2% to the cata treasury.</li>
            <li>2 · the treasury swaps bnb/usdt for $cata on pancakeswap.</li>
            <li>3 · bought $cata goes to 0x…dEaD. forever.</li>
          </ol>
          <p className="mt-5 text-xs text-surface/50">{active ? "buybacks are on — fees swap for $cata and burn." : "before launch, fees accrue and wait for activation."}</p>
        </div>
      </Reveal>
    </Page>
  );
}
