"use client";
import { useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { useAccount } from "wagmi";
import { Reveal } from "./Reveal";
import { useCata, useWalletUi } from "./web3/Providers";
import { api } from "@/lib/api";

export function PageHead({ kicker, title, sub, children }: { kicker: string; title: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <Reveal>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <p className="font-mono text-xs uppercase tracking-[.2em] text-pink">{kicker}</p>
          <h1 className="mt-4 font-display text-[clamp(2.4rem,9vw,6rem)] leading-[.95]">{title}</h1>
          {sub && <p className="mt-5 max-w-xl text-lg text-muted md:text-xl">{sub}</p>}
        </div>
        {children}
      </div>
    </Reveal>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-7xl px-4 pt-10 sm:pt-12 md:px-8 md:pt-16">{children}</div>;
}

export const pays = ["bnb", "usdt", "$cata"] as const;
export type Pay = (typeof pays)[number];

export function Toggle<T extends string>({ options, value, onChange, disabled = [], id, size = "md", dark = false }:
  { options: readonly T[]; value: T; onChange: (v: T) => void; disabled?: readonly T[]; id: string; size?: "sm" | "md"; dark?: boolean }) {
  return (
    <div className={`inline-flex flex-wrap rounded-full p-1 font-mono ${dark ? "bg-surface/10" : "bg-surface"} ${size === "sm" ? "text-xs" : "text-sm"}`}>
      {options.map((p) => {
        const off = disabled.includes(p);
        return (
          <button key={p} type="button" disabled={off} onClick={() => onChange(p)}
            className={`relative rounded-full transition pointer-coarse:min-h-11 ${size === "sm" ? "px-3 py-1.5" : "px-5 py-2"} ${off ? "cursor-not-allowed opacity-50" : dark ? "hover:text-surface" : "hover:text-ink"} ${value === p ? (dark ? "text-ink" : "text-surface") : dark ? "text-surface/70" : "text-muted"}`}>
            {value === p && <motion.span layoutId={id} className={`absolute inset-0 rounded-full ${dark ? "bg-surface" : "bg-ink"}`} transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
            <span className="relative">{p}{off && <span className="ml-1.5 text-[10px]">soon</span>}</span>
          </button>
        );
      })}
    </div>
  );
}

/** bnb · usdt · $cata — $cata unlocks once CataConfig.cataToken() is set (pass noCata where a contract never takes it). */
export function PayToggle({ value, onChange, id = "pay", size, noCata = false }: { value: Pay; onChange: (v: Pay) => void; id?: string; size?: "sm" | "md"; noCata?: boolean }) {
  const { active } = useCata();
  return <Toggle options={pays} value={value} onChange={onChange} disabled={active && !noCata ? [] : ["$cata"]} id={id} size={size} />;
}

/** Want toggle. With a backend card id, POST/DELETE /cards/:id/want using the connected wallet. */
export function WantButton({ count, className = "", cardId }: { count: number; className?: string; cardId?: string }) {
  const [on, setOn] = useState(false);
  const [n, setN] = useState<number | null>(null);
  const { address } = useAccount();
  const { openConnect } = useWalletUi();
  useEffect(() => {
    if (!cardId || !address) return;
    let live = true;
    api<{ wants: number; wanted?: boolean }>(`/cards/${encodeURIComponent(cardId)}/wants?wallet=${address}`)
      .then((r) => { if (live) { setN(r.wants); setOn(!!r.wanted); } }).catch(() => {});
    return () => { live = false; };
  }, [cardId, address]);
  const toggle = async () => {
    if (!cardId) return setOn(!on);
    if (!address) return openConnect();
    const next = !on;
    setOn(next);
    try {
      const r = await api<{ wants: number }>(`/cards/${encodeURIComponent(cardId)}/want`, {
        method: next ? "POST" : "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ wallet: address }),
      });
      setN(r.wants);
    } catch { /* offline: keep the optimistic state */ }
  };
  const shown = n ?? count + (on ? 1 : 0);
  return (
    <motion.button type="button" whileTap={{ scale: .92 }} onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(); }}
      aria-pressed={on} aria-label={`${on ? "remove from wants" : "want this card"} · ${shown.toLocaleString("en-US")} wants`}
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 font-mono text-xs transition pointer-coarse:min-h-11 ${on ? "bg-pink text-surface" : "border border-ink/15 bg-surface text-ink hover:border-pink hover:text-pink"} ${className}`}>
      <span aria-hidden>{on ? "♥" : "♡"}</span> want · {shown.toLocaleString("en-US")}
    </motion.button>
  );
}

export function SoonBanner({ children = "coming soon — switched off at launch" }: { children?: ReactNode }) {
  return (
    <div className="mb-10 flex items-center gap-3 rounded-[28px] border border-dashed border-deep/40 bg-soft/60 px-5 py-3 font-mono text-xs text-deep">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-deep" /> {children}
    </div>
  );
}

export function Stat({ k, v, dark = false }: { k: string; v: ReactNode; dark?: boolean }) {
  return (
    <div className={`rounded-3xl px-6 py-4 ${dark ? "bg-ink text-surface" : "bg-surface"}`}>
      <div className={`font-mono text-[10px] uppercase tracking-widest ${dark ? "text-surface/60" : "text-muted"}`}>{k}</div>
      <div className="mt-1 font-mono text-2xl">{v}</div>
    </div>
  );
}

export const btn = "rounded-full bg-ink px-6 py-3 font-medium text-surface transition-all hover:-translate-y-0.5 hover:bg-pink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:bg-ink";
export const btnPink = "rounded-full bg-pink px-6 py-3 font-medium text-surface shadow-[0_12px_30px_-12px_#E2487F] transition-all hover:-translate-y-0.5 hover:bg-deep disabled:cursor-not-allowed disabled:opacity-40";
export const btnLine = "rounded-full border-2 border-ink px-6 py-3 font-medium transition-all hover:-translate-y-0.5 hover:bg-ink hover:text-surface disabled:cursor-not-allowed disabled:opacity-40";
export const input = "w-full rounded-2xl border border-ink/15 bg-cream px-4 py-3 font-mono text-base outline-none transition focus:border-pink sm:text-sm";
export const card = "rounded-[32px] bg-surface p-6";
