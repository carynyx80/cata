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
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = prev; };
  }, [connectOpen, closeConnect, reset]);

  // EIP-6963 wallets show up as their own connectors; keep the generic "injected" one first.
  const list = [...connectors].sort((a, b) => (a.id === "injected" ? -1 : b.id === "injected" ? 1 : 0));
  const pendingId = isPending ? (variables?.connector as Connector | undefined)?.uid : undefined;

  return (
    <AnimatePresence>
      {connectOpen && (
        <motion.div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={closeConnect} />
          <motion.div role="dialog" aria-modal aria-label="connect a wallet"
            initial={{ opacity: 0, y: 24, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: .98 }}
            transition={{ duration: .28, ease: [0.22, 1, 0.36, 1] }}
            className="pb-safe relative max-h-[92dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-[32px] bg-surface px-5 pt-3 shadow-[0_50px_100px_-30px_rgba(43,26,34,.6)] sm:rounded-[36px] sm:p-8 sm:pb-8">
            <div aria-hidden className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-ink/15 sm:hidden" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-[.2em] text-pink">connect</p>
                <h2 className="mt-3 font-display text-[clamp(1.9rem,8vw,2.25rem)] leading-[.95]">pick a wallet.</h2>
              </div>
              <span className="shrink-0"><LogoMark size={54} /></span>
            </div>
            <p className="mt-3 text-muted">cata runs on bnb chain. you&apos;ll sign with your own wallet — we never hold your keys.</p>
            <div className="mt-6 space-y-2.5">
              {list.map((c) => {
                const busy = pendingId === c.uid;
                const missing = c.id === "injected" && !hasInjected;
                return (
                  <button key={c.uid} disabled={isPending || missing}
                    onClick={() => connect({ connector: c, chainId: CHAIN_ID })}
                    className="group flex min-h-16 w-full items-center justify-between gap-4 rounded-3xl bg-cream px-4 py-3.5 sm:px-5 sm:py-4 text-left transition hover:-translate-y-0.5 hover:bg-soft disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:bg-cream">
                    <span className="flex min-w-0 items-center gap-3.5">
                      {c.icon
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={c.icon} alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded-xl" />
                        : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink font-display text-lg text-surface">{label(c)[0]}</span>}
                      <span className="min-w-0">
                        <span className="block font-medium">{label(c)}</span>
                        <span className="block font-mono text-[11px] text-muted">{missing ? "no browser wallet found" : blurb[c.id] ?? blurb[c.type] ?? "detected in your browser"}</span>
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-xs text-muted transition group-hover:translate-x-0.5 group-hover:text-pink">{busy ? "check wallet…" : "→"}</span>
                  </button>
                );
              })}
            </div>
            {error && <p className="mt-4 rounded-2xl bg-soft/70 px-4 py-3 font-mono text-[11px] text-deep">{error.message.split("\n")[0].toLowerCase()}</p>}
            <div className="mt-6 flex items-center justify-between font-mono text-[11px] text-muted">
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#F0B90B]" /> bnb smart chain · 56</span>
              <button onClick={closeConnect} className="min-h-11 rounded-full px-4 hover:bg-cream hover:text-ink">close</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
