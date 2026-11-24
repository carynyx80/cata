"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useConfig } from "wagmi";
import { getPublicClient, readContract } from "wagmi/actions";
import { formatUnits, type Abi } from "viem";
import { packMachineAbi } from "@/lib/abis";
import { addresses } from "@/lib/contracts";
import { fmt } from "@/lib/data";
import { Slab } from "../Slab";
import { btnPink, btnLine } from "../ui";
import { loadSlab, type Slabbed } from "./slabs";
import { useTx } from "./tx";

export type Pending = { creditId: bigint; requestId?: bigint; pool: string; fromBlock: bigint };

/** VRF pending state → reveal the pulled card (PackOpened event) → optional sell back within the window. */
export function PackReveal({ pending, onClose }: { pending: Pending | null; onClose: () => void }) {
  const config = useConfig();
  const { run, busy } = useTx();
  const [card, setCard] = useState<Slabbed | null>(null);
  const [quote, setQuote] = useState<bigint | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [sold, setSold] = useState(false);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!pending || !addresses.packMachine) return;
    const pm = addresses.packMachine;
    let stop = false;
    const started = Date.now();
    const tick = async () => {
      while (!stop) {
        try {
          const logs = await getPublicClient(config)!.getContractEvents({
            address: pm, abi: packMachineAbi, eventName: "PackOpened", args: { creditId: pending.creditId }, fromBlock: pending.fromBlock,
          });
          const ev = logs[0] as unknown as { args: { tokenId: bigint } } | undefined;
          if (ev) {
            const tokenId = ev.args.tokenId;
            const [slab, q, win] = await Promise.all([
              loadSlab(config, tokenId),
              readContract(config, { address: pm, abi: packMachineAbi, functionName: "sellbackQuote", args: [tokenId] }).catch(() => null),
              readContract(config, { address: pm, abi: packMachineAbi, functionName: "sellbackWindow" }).catch(() => null),
            ]);
            if (stop) return;
            setCard(slab); setQuote(q as bigint | null);
            if (win) {
              const ms = Number(win as bigint) * 1000;
              setDeadline(Date.now() + ms);
              setTimeout(() => setDeadline(null), ms);
            }
            return;
          }
        } catch { /* rpc hiccup, retry */ }
        if (Date.now() - started > 90_000) setSlow(true);
        await new Promise((r) => setTimeout(r, 3000));
      }
    };
    tick();
    return () => { stop = true; };
  }, [pending, config]);

  const sellBack = async () => {
    if (!card || !addresses.packMachine) return;
    try {
      await run("sell back", { address: addresses.packMachine, abi: packMachineAbi as Abi, functionName: "sellBack", args: [card.tokenId] }, { approveNft: card.tokenId });
      setSold(true);
    } catch { /* toast shown */ }
  };
  const open = deadline !== null; // cleared by a timer when the sell-back window closes

  return (
    <AnimatePresence>
      {pending && (
        <motion.div className="fixed inset-0 z-[60] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={card ? onClose : undefined} />
          <motion.div initial={{ y: 24, scale: .97 }} animate={{ y: 0, scale: 1 }} role="dialog" aria-modal aria-label="pack reveal" className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-[36px] bg-surface p-6 text-center sm:p-8">
            <p className="font-mono text-xs uppercase tracking-[.2em] text-pink">{pending.pool} pack · credit #{String(pending.creditId)}</p>
            {!card ? (
              <>
                <h2 className="mt-3 font-display text-4xl leading-[.95]">rolling the dice.</h2>
                <p className="mt-3 text-muted">chainlink vrf is picking your card on-chain. this usually takes under a minute.</p>
                <div className="relative mx-auto mt-8 h-64 w-44">
                  {[0, 1, 2].map((k) => (
                    <motion.div key={k} className="absolute inset-0 rounded-[22px] border-[5px] border-ink bg-soft"
                      animate={{ rotate: [-6 + k * 6, 6 - k * 6, -6 + k * 6], y: [0, -8, 0] }} transition={{ duration: 1.6, repeat: Infinity, delay: k * .15 }} />
                  ))}
                  <div className="absolute inset-0 flex items-center justify-center font-display text-7xl text-ink">?</div>
                </div>
                <p className="mt-6 font-mono text-[11px] text-muted">{slow ? "still waiting on vrf — you can close this; the card lands in your vault either way." : "watching packmachine for your pull…"}</p>
                <button onClick={onClose} className="mt-4 min-h-11 px-4 font-mono text-xs text-muted underline-offset-2 hover:text-ink hover:underline">close</button>
              </>
            ) : (
              <motion.div initial={{ opacity: 0, rotateY: 90 }} animate={{ opacity: 1, rotateY: 0 }} transition={{ duration: .6, ease: [0.22, 1, 0.36, 1] }}>
                <h2 className="mt-3 font-display text-4xl leading-[.95]">you pulled it.</h2>
                <div className="mx-auto mt-6 w-48"><Slab card={card} /></div>
                <div className="mt-4 font-medium">{card.name}</div>
                <div className="font-mono text-xs text-muted">{card.grader} {card.grade} · token #{String(card.tokenId)}{card.valueUsd ? ` · ${fmt(card.valueUsd)}` : ""}</div>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <button onClick={onClose} className={btnLine}>keep it</button>
                  {!sold && quote !== null && quote > 0n && open && (
                    <button onClick={sellBack} disabled={busy} className={btnPink}>{busy ? "selling…" : `sell back · ${Number(formatUnits(quote, 18)).toFixed(2)} usdt`}</button>
                  )}
                </div>
                {sold && <p className="mt-4 font-mono text-xs text-deep">sold back · usdt sent to your wallet</p>}
                {!sold && open && <p className="mt-3 font-mono text-[10px] text-muted">85% of index value, minus 0.2% · window closes {new Date(deadline!).toLocaleTimeString()}</p>}
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
