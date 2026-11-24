"use client";
import { useEffect } from "react";
import { useMounted } from "@/lib/hooks";
import { AnimatePresence, motion } from "framer-motion";
import { useAccount, useConnect, type Connector } from "wagmi";
import { useWalletUi } from "./Providers";
import { LogoMark } from "../Logo";
import { CHAIN_ID } from "@/lib/contracts";

const blurb: Record<string, string> = {
  injected: "metamask · trust · binance wallet · rabby",
  walletConnect: "scan with any mobile wallet",
  coinbaseWallet: "coinbase wallet app or extension",
};

function label(c: Connector) {
  if (c.id === "injected") return "browser wallet";
  if (c.id === "walletConnect") return "walletconnect";
  if (c.id === "coinbaseWalletSDK" || c.type === "coinbaseWallet") return "coinbase wallet";
  return c.name.toLowerCase();
}

export function ConnectModal() {
  const { connectOpen, closeConnect } = useWalletUi();
  const { connectors, connect, isPending, variables, error, reset } = useConnect();
  const { isConnected } = useAccount();
  const mounted = useMounted();
  const hasInjected = !mounted || !!(window as unknown as { ethereum?: unknown }).ethereum;

  useEffect(() => { if (isConnected) closeConnect(); }, [isConnected, closeConnect]);
  useEffect(() => {
    if (!connectOpen) return;
    reset();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && closeConnect();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [connectOpen, closeConnect, reset]);

  // EIP-6963 wallets show up as their own connectors; keep the generic "injected" one first.
  const list = [...connectors].sort((a, b) => (a.id === "injected" ? -1 : b.id === "injected" ? 1 : 0));
  const pendingId = isPending ? (variables?.connector as Connector | undefined)?.uid : undefined;

  return (
    <AnimatePresence>
      {connectOpen && (
        <motion.div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={closeConnect} />
          <motion.div role="dialog" aria-modal aria-label="connect a wallet"
            initial={{ opacity: 0, y: 24, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: .98 }}
            transition={{ duration: .28, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md rounded-[36px] bg-surface p-6 shadow-[0_50px_100px_-30px_rgba(43,26,34,.6)] sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-[.2em] text-pink">connect</p>
                <h2 className="mt-3 font-display text-4xl leading-[.95]">pick a wallet.</h2>
              </div>
              <LogoMark size={54} />
            </div>
            <p className="mt-3 text-muted">cata runs on bnb chain. you&apos;ll sign with your own wallet — we never hold your keys.</p>
            <div className="mt-6 space-y-2.5">
              {list.map((c) => {
                const busy = pendingId === c.uid;
                const missing = c.id === "injected" && !hasInjected;
                return (
                  <button key={c.uid} disabled={isPending || missing}
                    onClick={() => connect({ connector: c, chainId: CHAIN_ID })}
                    className="group flex w-full items-center justify-between gap-4 rounded-3xl bg-cream px-5 py-4 text-left transition hover:-translate-y-0.5 hover:bg-soft disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:bg-cream">
                    <span className="flex items-center gap-3.5">
                      {c.icon
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={c.icon} alt="" className="h-9 w-9 rounded-xl" />
                        : <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink font-display text-lg text-surface">{label(c)[0]}</span>}
                      <span>
                        <span className="block font-medium">{label(c)}</span>
                        <span className="block font-mono text-[11px] text-muted">{missing ? "no browser wallet found" : blurb[c.id] ?? blurb[c.type] ?? "detected in your browser"}</span>
                      </span>
                    </span>
                    <span className="font-mono text-xs text-muted transition group-hover:translate-x-0.5 group-hover:text-pink">{busy ? "check wallet…" : "→"}</span>
                  </button>
                );
              })}
            </div>
            {error && <p className="mt-4 rounded-2xl bg-soft/70 px-4 py-3 font-mono text-[11px] text-deep">{error.message.split("\n")[0].toLowerCase()}</p>}
            <div className="mt-6 flex items-center justify-between font-mono text-[11px] text-muted">
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#F0B90B]" /> bnb smart chain · 56</span>
              <button onClick={closeConnect} className="rounded-full px-3 py-1 hover:bg-cream hover:text-ink">close</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
