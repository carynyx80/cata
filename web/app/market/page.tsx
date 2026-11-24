"use client";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Slab } from "@/components/Slab";
import { Reveal } from "@/components/Reveal";
import { Page, PageHead, PayToggle, Toggle, btnPink, type Pay } from "@/components/ui";
import { catalog, fmt, games, type Game } from "@/lib/data";

const BNB = 620;
const sorts = ["newest", "price ↑", "price ↓"] as const;
const listings = catalog.map((c, i) => ({ ...c, price: Math.round(c.value * (0.92 + ((i * 37) % 17) / 100)), seller: `0x${(9134 + i * 773).toString(16)}…${(41 + i * 13).toString(16)}`, age: i }));

export default function Market() {
  const [pay, setPay] = useState<Pay>("bnb");
  const [sort, setSort] = useState<(typeof sorts)[number]>("newest");
  const [game, setGame] = useState<Game | "all">("all");
  const [physical, setPhysical] = useState(false);
  const list = useMemo(() => {
    const l = listings.filter((c) => (game === "all" || c.game === game) && (!physical || !c.digital));
    return [...l].sort((a, b) => sort === "price ↑" ? a.price - b.price : sort === "price ↓" ? b.price - a.price : a.age - b.age);
  }, [sort, game, physical]);
  const show = (usd: number) => pay === "bnb" ? `${(usd / BNB).toFixed(3)} bnb` : `${usd.toLocaleString("en-US")} usdt`;
  return (
    <Page>
      <PageHead kicker="market" title="slabs for sale." sub="peer to peer. every sale settles on-chain, 0.2% burns $cata.">
        <button className={btnPink}>list a card →</button>
      </PageHead>
      <div className="mt-10 flex flex-col gap-3 rounded-[28px] bg-surface p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {(["all", ...games] as const).map((g) => (
            <button key={g} onClick={() => setGame(g)} className={`rounded-full px-4 py-2 text-sm transition ${game === g ? "bg-ink text-surface" : "bg-cream text-muted hover:text-ink"}`}>{g}</button>
          ))}
          <button onClick={() => setPhysical(!physical)} className={`rounded-full px-4 py-2 text-sm transition ${physical ? "bg-pink text-surface" : "bg-cream text-muted hover:text-ink"}`}>physical only</button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="pl-2 font-mono text-[10px] uppercase tracking-widest text-muted">pay in</span>
          <PayToggle value={pay} onChange={setPay} id="mpay" size="sm" />
          <Toggle options={sorts} value={sort} onChange={setSort} id="msort" size="sm" />
        </div>
      </div>
      <motion.div layout className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {list.map((c, i) => (
          <motion.div key={c.id} layout transition={{ type: "spring", stiffness: 300, damping: 30 }}>
            <Reveal delay={(i % 4) * .05}>
              <div className="rounded-[32px] bg-surface p-4 transition-shadow hover:shadow-[0_30px_60px_-30px_rgba(43,26,34,.4)]">
                <Slab card={c} />
                <div className="mt-4 px-1">
                  <div className="truncate font-medium">{c.name}</div>
                  <div className="truncate font-mono text-xs text-muted">{c.grader} {c.grade} · {c.set}</div>
                  <div className="mt-3 flex items-end justify-between">
                    <div><div className="font-mono text-xl">{show(c.price)}</div><div className="font-mono text-[11px] text-muted">≈ {fmt(c.price)}</div></div>
                    <div className="font-mono text-[10px] text-muted">{c.seller}</div>
                  </div>
                </div>
                <button className="mt-4 w-full rounded-full bg-ink py-2.5 text-surface transition hover:bg-pink">buy now</button>
              </div>
            </Reveal>
          </motion.div>
        ))}
      </motion.div>
    </Page>
  );
}
