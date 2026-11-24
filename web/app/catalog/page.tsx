"use client";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CardTile } from "@/components/CardTile";
import { Page, PageHead, input } from "@/components/ui";
import { catalog, games, type Game } from "@/lib/data";

export default function Catalog() {
  const [q, setQ] = useState("");
  const [game, setGame] = useState<Game | "all">("all");
  const list = useMemo(() => catalog.filter((c) =>
    (game === "all" || c.game === game) && (c.name + " " + c.set).toLowerCase().includes(q.trim().toLowerCase())), [q, game]);
  return (
    <Page>
      <PageHead kicker="catalog" title="every card on earth." sub="prices for raw, psa 9 and psa 10. hit want and we'll hunt it for the next pack pool." />
      <div className="mt-10 flex flex-col gap-4 lg:flex-row lg:items-center">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="search charizard, black lotus, wemby…" className={`${input} bg-surface lg:max-w-md`} />
        <div className="flex flex-wrap gap-2">
          {(["all", ...games] as const).map((g) => (
            <button key={g} onClick={() => setGame(g)}
              className={`rounded-full px-4 py-2 text-sm transition ${game === g ? "bg-ink text-surface" : "bg-surface text-muted hover:text-ink"}`}>{g}</button>
          ))}
        </div>
      </div>
      <div className="mt-3 font-mono text-xs text-muted">{list.length} cards · sample data</div>
      <motion.div layout className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <AnimatePresence mode="popLayout">
          {list.map((c) => (
            <motion.div key={c.id} layout initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .96 }} transition={{ duration: .3 }}>
              <CardTile c={c} />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
      {list.length === 0 && <div className="mt-10 rounded-[32px] bg-surface p-10 text-center text-muted">nothing yet. try another name — or want it and we&apos;ll find it.</div>}
    </Page>
  );
}
