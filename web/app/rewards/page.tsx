"use client";
import { MotionConfig, motion, useReducedMotion } from "framer-motion";
import { Reveal } from "@/components/Reveal";
import { useAccount, useReadContract } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { Page, PageHead, Stat } from "@/components/ui";
import { useCata } from "@/components/web3/Providers";
import { cataPointsAbi } from "@/lib/abis";
import { addresses } from "@/lib/contracts";
import { api } from "@/lib/api";

const sets = [["base set holo trio", 2, 3, 500], ["eeveelution alt arts", 5, 8, 1200], ["op-01 leaders", 3, 9, 600], ["prizm rookie class '23", 1, 5, 800]] as const;
const earn = [["open a pack", "+10 / $1"], ["complete a set", "bonus shown per set"], ["sell on market", "+2 / $1"], ["win a prediction", "+5 / $1"]];

/** CataPoints.points(address) on-chain, else backend /points/:wallet, else the sample number. */
function usePoints() {
  const { address } = useAccount();
  const chain = useReadContract({ address: addresses.points, abi: cataPointsAbi, functionName: "points", args: address ? [address] : undefined, query: { enabled: !!addresses.points && !!address } });
  const backend = useQuery({ queryKey: ["points", address], enabled: !!address && !addresses.points, queryFn: () => api<{ points: string }>(`/points/${address}`), retry: 1 });
  if (!address) return null;
  if (chain.data !== undefined) return Number(chain.data as bigint);
  if (backend.data) return Number(backend.data.points);
  return null;
}

/** page-level a11y + responsive helpers (scoped here so shared components stay untouched) */
const shell = "[&_:focus-visible]:outline-2 [&_:focus-visible]:outline-offset-2 [&_:focus-visible]:outline-pink [&_h1]:text-[clamp(2.25rem,9vw,6rem)] [&_h1]:text-balance";

export default function Rewards() {
  const reduce = useReducedMotion();
  const pts = usePoints();
  const { active } = useCata();
  return (
    <MotionConfig reducedMotion="user"><div className={shell}><Page>
      <PageHead kicker="rewards" title="collect, get paid." sub="earn cata points for ripping and completing sets.">
        <div className="flex flex-wrap gap-3"><Stat k="points" v={pts !== null ? pts.toLocaleString("en-US") : "12,340"} dark />{pts === null && <Stat k="rank" v="top 8%" />}</div>
      </PageHead>
      <div className="mt-8 rounded-2xl bg-soft px-5 py-3 font-mono text-xs leading-relaxed text-deep md:rounded-full">{active ? "✦ $cata is live — points convert to $cata, paid from buybacks." : "✦ points become $cata after launch — paid from buybacks."}</div>
      <div className="mt-10 grid gap-4 sm:gap-5 md:grid-cols-2">
        {sets.map(([n, have, of, pts], i) => (
          <Reveal key={n} delay={(i % 2) * .06} className="min-w-0">
            <div className="rounded-[28px] bg-surface p-5 sm:rounded-[32px] sm:p-6">
              <div className="flex items-baseline justify-between gap-3"><h3 className="min-w-0 font-display text-xl leading-tight">{n}</h3><span className="shrink-0 font-mono text-sm">{have}/{of}</span></div>
              <div className="mt-4 h-2.5 rounded-full bg-cream" role="progressbar" aria-label={`${n} progress`} aria-valuemin={0} aria-valuemax={of} aria-valuenow={have}><motion.div className="h-full rounded-full bg-pink" initial={{ width: 0 }} whileInView={{ width: `${(have / of) * 100}%` }} viewport={{ once: true }} transition={reduce ? { duration: 0 } : { duration: .9, ease: [0.22, 1, 0.36, 1] }} /></div>
              <div className="mt-3 font-mono text-[11px] text-muted">complete for +{pts.toLocaleString("en-US")} points</div>
            </div>
          </Reveal>
        ))}
      </div>
      <Reveal>
        <div className="mt-5 grid grid-cols-2 gap-4 rounded-[28px] bg-ink p-5 text-surface sm:rounded-[32px] sm:p-6 lg:grid-cols-4">
          {earn.map(([k, v]) => <div key={k}><div className="font-mono text-[10px] uppercase tracking-widest text-surface/60">{k}</div><div className="mt-1 font-mono">{v}</div></div>)}
        </div>
      </Reveal>
    </Page></div></MotionConfig>
  );
}
