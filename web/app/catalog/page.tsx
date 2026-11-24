"use client";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { CardTile } from "@/components/CardTile";
import { Page, PageHead, input } from "@/components/ui";
import { catalog, fromApi, gameKey, games, type Game } from "@/lib/data";
import { api, type ApiCard } from "@/lib/api";

export default function Catalog() {
  const [q, setQ] = useState("");
  const [game, setGame] = useState<Game | "all">("all");
  const [dq, setDq] = useState("");
  useEffect(() => { const t = setTimeout(() => setDq(q.trim()), 250); return () => clearTimeout(t); }, [q]);
  // backend GET /catalog; falls back to the sample catalog when the API is unreachable
  const remote = useQuery({
    queryKey: ["catalog", dq, game],
    queryFn: () => api<{ items: ApiCard[]; total: number }>(`/catalog?limit=48${dq ? `&q=${encodeURIComponent(dq)}` : ""}${game !== "all" ? `&game=${gameKey(game)}` : ""}`),
    retry: 1, staleTime: 60_000, placeholderData: (prev) => prev,
  });
  const sample = useMemo(() => catalog.filter((c) =>
    (game === "all" || c.game === game) && (c.name + " " + c.set).toLowerCase().includes(q.trim().toLowerCase())), [q, game]);
  const list = remote.data ? remote.data.items.map((a) => fromApi(a)) : sample;
  return (
    <Page>
      <PageHead kicker="catalog" title="every card on earth." sub="prices for raw, psa 9 and psa 10. hit want and we'll hunt it for the next pack pool." />
      <div className="mt-10 flex flex-col gap-4 lg:flex-row lg:items-center">
        <input type="search" aria-label="search cards" enterKeyHint="search" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} placeholder="search charizard, black lotus, wemby…" className={`${input} bg-surface lg:max-w-md`} />
        <div className="flex flex-wrap gap-2">
          {(["all", ...games] as const).map((g) => (
            <button key={g} onClick={() => setGame(g)} aria-pressed={game === g}
              className={`rounded-full px-4 py-2 text-sm transition pointer-coarse:min-h-11 ${game === g ? "bg-ink text-surface" : "bg-surface text-muted hover:text-ink"}`}>{g}</button>
          ))}
        </div>
      </div>
      <div className="mt-3 font-mono text-xs text-muted">{remote.data ? `${remote.data.total.toLocaleString("en-US")} cards · cata price index` : `${list.length} cards · sample data`}</div>
      <motion.div layout className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
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
