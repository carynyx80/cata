"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { parseUnits, type Abi } from "viem";
import { cataMarketAbi } from "@/lib/abis";
import { addresses, payToken } from "@/lib/contracts";
import { fmt } from "@/lib/data";
import { Slab } from "../Slab";
import { PayToggle, btnPink, input, type Pay } from "../ui";
import { useCata } from "./Providers";
import { useMySlabs } from "./slabs";
import { useTx } from "./tx";

/** List a vaulted slab on CataMarket: approve the NFT, then list(tokenId, token, price). */
export function ListModal({ open, onClose, preselect, onListed }: { open: boolean; onClose: () => void; preselect?: bigint; onListed?: () => void }) {
  const slabs = useMySlabs();
  const { token: cata } = useCata();
  const { run, busy } = useTx();
  const [picked, setSel] = useState<bigint | undefined>();
  const sel = picked ?? preselect ?? slabs.data?.[0]?.tokenId;
  const [pay, setPay] = useState<Pay>("usdt");
  const [price, setPrice] = useState("");

  const close = () => { setSel(undefined); setPrice(""); onClose(); };
  const submit = async () => {
    const token = payToken(pay, cata);
    if (sel === undefined || !token || !addresses.market || !(parseFloat(price) > 0)) return;
    try {
      await run("list slab", { address: addresses.market, abi: cataMarketAbi as Abi, functionName: "list", args: [sel, token, parseUnits(price, 18)] }, { approveNft: sel });
      onListed?.(); close();
    } catch { /* toast shown */ }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={close} />
          <motion.div initial={{ y: 24, scale: .97 }} animate={{ y: 0, scale: 1 }} role="dialog" aria-modal aria-label="list a card" className="pb-safe relative max-h-[92dvh] w-full max-w-xl overflow-y-auto overscroll-contain rounded-t-[32px] bg-surface px-5 pt-6 sm:rounded-[36px] sm:p-8 sm:pb-8">
            <p className="font-mono text-xs uppercase tracking-[.2em] text-pink">list a card</p>
            <h2 className="mt-3 font-display text-[clamp(1.9rem,8vw,2.25rem)] leading-[.95]">set your price.</h2>
            <div className="mt-6 font-mono text-[10px] uppercase tracking-widest text-muted">1 · pick a slab</div>
            {slabs.isLoading ? <p className="mt-3 font-mono text-xs text-muted">reading your vault…</p>
              : !slabs.data?.length ? <p className="mt-3 font-mono text-xs text-muted">no slabs in this wallet yet — open a pack first.</p>
              : (
                <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {slabs.data.map((v) => (
                    <button key={String(v.tokenId)} onClick={() => setSel(v.tokenId)} className={`rounded-3xl p-2 text-left transition ${sel === v.tokenId ? "bg-soft ring-2 ring-pink" : "bg-cream hover:bg-soft/50"}`}>
                      <Slab card={v} hover={false} className="!border-[3px] !p-1.5" />
                      <div className="mt-2 truncate px-1 text-xs font-medium">{v.name}</div>
                      {v.valueUsd ? <div className="px-1 font-mono text-[11px] text-muted">{fmt(v.valueUsd)}</div> : null}
                    </button>
                  ))}
                </div>
              )}
            <div className="mt-6 font-mono text-[10px] uppercase tracking-widest text-muted">2 · get paid in</div>
            <div className="mt-3"><PayToggle value={pay} onChange={setPay} id="lpay" size="sm" /></div>
            <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))} placeholder={`price in ${pay}`} inputMode="decimal" className={`${input} mt-4 text-lg`} />
            <p className="mt-2 font-mono text-[10px] text-muted">buyer pays this · 0.2% fee is taken from it and burns $cata</p>
            <div className="mt-6 flex justify-between gap-3">
              <button onClick={close} className="min-h-11 rounded-full px-5 py-3 font-mono text-xs text-muted hover:text-ink">cancel</button>
              <button onClick={submit} disabled={busy || sel === undefined || !(parseFloat(price) > 0)} className={btnPink}>{busy ? "listing…" : "approve & list →"}</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
