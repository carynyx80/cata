"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAccount, useDisconnect, useSwitchChain } from "wagmi";
import Link from "next/link";
import { useCata, useWalletUi } from "./Providers";
import { CHAIN_ID, bscscanAddr, short } from "@/lib/contracts";
import { useMounted } from "@/lib/hooks";

const base = "rounded-full px-4 py-2 text-sm font-medium transition-all hover:-translate-y-0.5 active:translate-y-0";

export function ConnectButton() {
  const { address, isConnected, chainId, status } = useAccount();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const { openConnect } = useWalletUi();
  const [open, setOpen] = useState(false);
  const mounted = useMounted();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  if (!mounted || !isConnected || !address) {
    return (
      <button onClick={openConnect} disabled={status === "reconnecting"} className={`${base} bg-ink text-surface hover:bg-deep`}>
        connect<span className="hidden sm:inline"> wallet</span>
      </button>
    );
  }
  if (chainId !== CHAIN_ID) {
    return (
      <button onClick={() => switchChain({ chainId: CHAIN_ID })} disabled={switching} className={`${base} bg-pink text-surface hover:bg-deep`}>
        {switching ? "switching…" : <>switch<span className="hidden sm:inline"> to bnb chain</span></>}
      </button>
    );
  }
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className={`${base} flex items-center gap-2 bg-ink font-mono text-[13px] text-surface hover:bg-deep`}>
        <span className="h-1.5 w-1.5 rounded-full bg-pink" />{short(address)}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: .98 }} transition={{ duration: .18 }}
            className="absolute right-0 top-12 w-60 origin-top-right rounded-3xl border border-ink/10 bg-surface p-2 shadow-[0_30px_60px_-25px_rgba(43,26,34,.45)]">
            <div className="px-3.5 py-2.5 font-mono text-[11px] text-muted">connected · bnb chain</div>
            <button onClick={() => { navigator.clipboard?.writeText(address); setOpen(false); }} className="block w-full rounded-2xl px-3.5 py-2.5 text-left text-[15px] transition hover:bg-cream">copy address</button>
            <a href={bscscanAddr(address)} target="_blank" rel="noreferrer" className="block rounded-2xl px-3.5 py-2.5 text-[15px] transition hover:bg-cream">view on bscscan ↗</a>
            <a href="/vault" className="block rounded-2xl px-3.5 py-2.5 text-[15px] transition hover:bg-cream">my vault</a>
            <button onClick={() => { disconnect(); setOpen(false); }} className="block w-full rounded-2xl px-3.5 py-2.5 text-left text-[15px] text-pink transition hover:bg-cream">disconnect</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** "$cata soon" until CataConfig.cataToken() is set, then "$cata live". */
export function CataPill({ className = "" }: { className?: string }) {
  const { active } = useCata();
  return <Link href="/token" className={className}>{active ? "$cata live" : "$cata soon"}</Link>;
}
