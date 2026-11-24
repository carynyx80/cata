"use client";
import Link from "next/link";
import { Slab } from "./Slab";
import { WantButton } from "./ui";
import { fmt, type CatalogCard } from "@/lib/data";

export function CardTile({ c }: { c: CatalogCard }) {
  return (
    <Link href={`/catalog/${c.id}`} className="group block h-full rounded-[32px] bg-surface p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_30px_60px_-30px_rgba(43,26,34,.4)]">
      <div className="relative">
        <Slab card={c} hover={false} />
        {c.inVault && <span className="absolute right-3 top-[4.2rem] rounded-full bg-ink px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest text-surface">in vault</span>}
      </div>
      <div className="mt-4 px-1">
        <div className="flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-widest text-muted"><span>{c.game}</span></div>
        <div className="mt-1 truncate font-medium group-hover:text-pink">{c.name}</div>
        <div className="truncate font-mono text-xs text-muted">{c.set}</div>
        <div className="mt-3 grid grid-cols-3 gap-1 rounded-2xl bg-cream p-2 text-center font-mono">
          {([["raw", c.raw], ["psa 9", c.psa9], ["psa 10", c.psa10]] as const).map(([k, v]) => (
            <div key={k}><div className="text-[9px] uppercase tracking-widest text-muted">{k}</div><div className="text-[13px]">{fmt(v)}</div></div>
          ))}
        </div>
        <div className="mt-3"><WantButton count={c.wants} cardId={c.apiId} /></div>
      </div>
    </Link>
  );
}
