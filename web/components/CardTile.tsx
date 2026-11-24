"use client";
import Link from "next/link";
import { Slab } from "./Slab";
import { WantButton } from "./ui";
import { fmt, type CatalogCard } from "@/lib/data";

export function CardTile({ c }: { c: CatalogCard }) {
  return (
    <Link href={`/catalog/${c.id}`} className="group block h-full rounded-[24px] bg-surface p-2.5 transition-all min-[480px]:rounded-[32px] min-[480px]:p-4 duration-300 hover:-translate-y-1 hover:shadow-[0_30px_60px_-30px_rgba(43,26,34,.4)]">
      <div className="relative">
        <Slab card={c} hover={false} />
        {c.inVault && <span className="absolute right-2 top-[3.6rem] rounded-full max-[479px]:hidden min-[480px]:right-3 min-[480px]:top-[4.2rem] bg-ink px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest text-surface">in vault</span>}
      </div>
      <div className="mt-3 px-0.5 min-[480px]:mt-4 min-[480px]:px-1">
        <div className="flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-widest text-muted"><span>{c.game}</span></div>
        <div className="mt-1 truncate text-[15px] font-medium group-hover:text-pink min-[480px]:text-base">{c.name}</div>
        <div className="truncate font-mono text-xs text-muted">{c.set}</div>
        <div className="mt-3 grid grid-cols-1 gap-0.5 rounded-2xl bg-cream px-2.5 py-2 font-mono min-[480px]:grid-cols-3 min-[480px]:gap-1 min-[480px]:p-2 min-[480px]:text-center">
          {([["raw", c.raw], ["psa 9", c.psa9], ["psa 10", c.psa10]] as const).map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-2 min-[480px]:block"><div className="text-[9px] uppercase tracking-widest text-muted">{k}</div><div className="text-[12px] min-[480px]:text-[13px]">{fmt(v)}</div></div>
          ))}
        </div>
        <div className="mt-3"><WantButton count={c.wants} cardId={c.apiId} className="max-[479px]:w-full max-[479px]:px-2" /></div>
      </div>
    </Link>
  );
}
