"use client";
import { MotionConfig } from "framer-motion";
import { Reveal } from "@/components/Reveal";
import { useState } from "react";
import { Page } from "@/components/ui";
import { useCata } from "@/components/web3/Providers";
import { bscscanAddr, pancakeBuy } from "@/lib/contracts";

const facts = [["supply", "1,000,000,000"], ["launch", "fair launch"], ["where", "flap.sh"], ["burn", "0.2% of every tx"]];
const perks = [["discounts", "pay for packs and fees in $cata and pay less."], ["$cata betting pools", "prediction markets with $cata pools, alongside bnb and usdt."], ["early grail drops", "holders get first access to grail pools and rare drops."]];

/** page-level a11y + responsive helpers (scoped here so shared components stay untouched) */
const shell = "[&_:focus-visible]:outline-2 [&_:focus-visible]:outline-offset-2 [&_:focus-visible]:outline-pink [&_h1]:text-[clamp(2.25rem,9vw,6rem)] [&_h1]:text-balance";

/** Copy with a fallback for in-app browsers / non-secure contexts where navigator.clipboard is missing. */
async function copyText(t: string) {
  try { await navigator.clipboard.writeText(t); return true; } catch { /* fall through */ }
  const ta = document.createElement("textarea");
  ta.value = t; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta); ta.select();
  let ok = false;
  try { ok = document.execCommand("copy"); } catch { /* ignore */ }
  ta.remove();
  return ok;
}

export default function Token() {
  const { token, active } = useCata();
  const [copied, setCopied] = useState(false);
  const copy = async () => { if (token && await copyText(token)) { setCopied(true); setTimeout(() => setCopied(false), 1500); } };
  return (
    <MotionConfig reducedMotion="user"><div className={shell}><Page>
      <Reveal>
        <div className="relative overflow-hidden rounded-[32px] bg-pink p-6 text-surface sm:rounded-[40px] sm:p-8 md:p-16">
          <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-deep blur-2xl" aria-hidden />
          <div className="relative">
            <p className="font-mono text-xs uppercase tracking-[.2em] text-soft">{active ? "$cata · live on bnb chain" : "$cata · coming soon on flap.sh"}</p>
            <h1 className="mt-4 font-display !text-[clamp(2.4rem,9vw,7rem)] leading-[.92]">every move burns.</h1>
            <p className="mt-6 max-w-xl text-base text-surface/85 sm:text-lg">0.2% of every transaction on cata — packs, trades, loans, bets — buys back $cata on pancakeswap and burns it. fair launch on flap.sh.</p>
            <div className="mt-8 grid grid-cols-2 gap-3 sm:mt-10 md:grid-cols-4">
              {facts.map(([k, v]) => (
                <div key={k} className="min-w-0 rounded-3xl bg-surface/10 p-4 backdrop-blur first:col-span-2 sm:p-5 md:first:col-span-1"><div className="font-mono text-[10px] uppercase tracking-widest text-surface/70">{k}</div><div className="mt-1 font-mono text-base [overflow-wrap:anywhere] sm:text-lg">{v}</div></div>
              ))}
            </div>
          </div>
        </div>
      </Reveal>
      <Reveal>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-[28px] bg-surface p-5 sm:rounded-[32px] sm:p-6">
          <div className="min-w-0"><div className="font-mono text-[10px] uppercase tracking-widest text-muted">contract address{active && <span className="ml-2 rounded-full bg-pink px-2 py-0.5 text-[9px] text-surface">$cata live</span>}</div>
            {active ? <a href={bscscanAddr(token!)} target="_blank" rel="noreferrer" className="mt-1 block break-all font-mono text-base text-ink hover:text-pink sm:text-lg">{token}</a>
              : <div className="mt-1 font-mono text-lg text-muted">ca drops at launch</div>}</div>
          {active ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={copy} aria-live="polite" className="min-h-11 rounded-full border border-ink/15 px-5 py-2.5 font-mono text-xs transition hover:border-ink">{copied ? "copied ✓" : "copy ca"}</button>
              <a href={pancakeBuy(token!)} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-full bg-pink px-5 py-2.5 font-mono text-xs text-surface transition hover:bg-deep">buy on pancakeswap ↗</a>
            </div>
          ) : <button type="button" disabled className="min-h-11 rounded-full border border-ink/15 px-5 py-2.5 font-mono text-xs text-muted/60">copy · soon</button>}
        </div>
      </Reveal>
      <h2 className="mt-16 font-display md:mt-20 text-[clamp(2rem,4.5vw,3.5rem)] leading-[1]">what holders get.</h2>
      <div className="mt-8 grid gap-4 sm:gap-5 md:grid-cols-3">
        {perks.map(([t, d], i) => (
          <Reveal key={t} delay={i * .06} className="min-w-0">
            <div className="h-full rounded-[28px] bg-surface p-6 transition motion-safe:hover:-translate-y-1.5 sm:rounded-[32px] sm:p-7"><div className="font-mono text-sm text-pink">0{i + 1}</div><h3 className="mt-6 font-display text-2xl leading-tight md:mt-8">{t}</h3><p className="mt-3 text-muted">{d}</p></div>
          </Reveal>
        ))}
      </div>
      <Reveal>
        <div className="mt-5 rounded-[28px] bg-ink p-6 text-surface sm:rounded-[32px] sm:p-7 md:p-10">
          <h3 className="font-display text-2xl">how the burn works.</h3>
          <ol className="mt-4 grid gap-4 font-mono text-sm text-surface/75 md:grid-cols-3">
            <li>1 · every tx pays 0.2% to the cata treasury.</li>
            <li>2 · the treasury swaps bnb/usdt for $cata on pancakeswap.</li>
            <li>3 · bought $cata goes to 0x…dEaD. forever.</li>
          </ol>
          <p className="mt-5 text-xs text-surface/50">{active ? "buybacks are on — fees swap for $cata and burn." : "before launch, fees accrue and wait for activation."}</p>
        </div>
      </Reveal>
    </Page></div></MotionConfig>
  );
}
