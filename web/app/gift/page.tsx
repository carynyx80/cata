"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Reveal } from "@/components/Reveal";
import { Page, PageHead, PayToggle, input, btnPink, btn, type Pay } from "@/components/ui";

const tiers = [["starter", 25], ["collector", 50], ["grail", 250]] as const;

export default function Gift() {
  const [tier, setTier] = useState(1);
  const [pay, setPay] = useState<Pay>("usdt");
  const [code, setCode] = useState<string | null>(null);
  const [claim, setClaim] = useState("");
  const [claimed, setClaimed] = useState(false);
  return (
    <Page>
      <PageHead kicker="gift a pack" title="send an unopened rip." sub="pay for a pack, get a claim link. they open it — the pull is theirs." />
      <div className="mt-12 grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Reveal>
          <div className="rounded-[32px] bg-surface p-6 md:p-8">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted">1 · choose a tier</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {tiers.map(([n, p], i) => (
                <button key={n} onClick={() => { setTier(i); setCode(null); }}
                  className={`rounded-3xl p-5 text-left transition ${tier === i ? "bg-ink text-surface" : "bg-cream hover:bg-soft/60"}`}>
                  <div className="font-mono text-[10px] uppercase tracking-widest opacity-70">{n}</div>
                  <div className="mt-3 font-display text-4xl">${p}</div>
                </button>
              ))}
            </div>
            <div className="mt-6 font-mono text-[10px] uppercase tracking-widest text-muted">2 · pay</div>
            <div className="mt-3"><PayToggle value={pay} onChange={setPay} id="gpay" /></div>
            <button onClick={() => setCode(`CATA-${tiers[tier][0].slice(0, 3).toUpperCase()}-7Q4K-M2XP`)} className={`${btnPink} mt-6`}>pay ${tiers[tier][1]} in {pay} & get link</button>
            <AnimatePresence>
              {code && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="mt-6 rounded-3xl bg-soft p-5">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-deep">3 · send this · sample</div>
                    <div className="mt-2 break-all font-mono text-sm">cata.gg/claim/{code}</div>
                    <div className="mt-1 font-mono text-2xl">{code}</div>
                    <button onClick={() => navigator.clipboard?.writeText(`cata.gg/claim/${code}`)} className={`${btn} mt-4 py-2 text-sm`}>copy link</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Reveal>
        <Reveal delay={.06}>
          <div className="h-full rounded-[32px] bg-ink p-6 text-surface md:p-8">
            <div className="font-mono text-[10px] uppercase tracking-widest text-surface/60">got a gift?</div>
            <h3 className="mt-3 font-display text-3xl">claim a gift.</h3>
            <p className="mt-2 text-surface/60">paste your code. the pack lands in your vault, ready to rip.</p>
            <input value={claim} onChange={(e) => { setClaim(e.target.value.toUpperCase()); setClaimed(false); }} placeholder="CATA-XXX-XXXX-XXXX" className={`${input} mt-6 border-surface/15 bg-surface/5 text-surface`} />
            <button disabled={claim.length < 8} onClick={() => setClaimed(true)} className={`${btnPink} mt-4 w-full`}>claim pack</button>
            {claimed && <p className="mt-4 font-mono text-xs text-soft">claimed · collector pack added to your vault (sample)</p>}
          </div>
        </Reveal>
      </div>
    </Page>
  );
}
