"use client";
import type { ReactNode } from "react";
import { useMounted } from "@/lib/hooks";
import { useAccount, useSwitchChain } from "wagmi";
import { useWalletUi } from "./Providers";
import { CHAIN_ID, has, type ContractKey } from "@/lib/contracts";

/**
 * An on-chain action button. Keeps the caller's styling and:
 *  - when any `need`ed contract address is missing → disabled, "contracts launching soon" tooltip
 *  - when no wallet → opens the connect modal
 *  - when on the wrong network → switches to bnb chain
 *  - otherwise runs `onClick`
 */
export function Act({ need, onClick, className = "", children, disabled, busy, busyLabel = "working…", soonLabel }:
  { need: ContractKey[]; onClick: () => unknown; className?: string; children: ReactNode; disabled?: boolean; busy?: boolean; busyLabel?: ReactNode; soonLabel?: string }) {
  const ready = has(...need);
  const { isConnected, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const { openConnect } = useWalletUi();
  const mounted = useMounted();

  if (!ready) {
    return (
      <span className={`group/act relative block ${className.includes("w-full") ? "w-full" : "inline-block"}`}>
        <button type="button" disabled aria-disabled title={soonLabel ?? "contracts launching soon"} className={`${className} cursor-not-allowed opacity-50`}>{children}</button>
        <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-3 py-1.5 font-mono text-[10px] text-surface opacity-0 shadow-lg transition group-hover/act:opacity-100">
          {soonLabel ?? "contracts launching soon"}
        </span>
      </span>
    );
  }
  const wrong = mounted && isConnected && chainId !== CHAIN_ID;
  const handle = () => {
    if (!isConnected) return openConnect();
    if (wrong) return switchChain({ chainId: CHAIN_ID });
    onClick();
  };
  return (
    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handle(); }} disabled={disabled || busy} className={`${className} disabled:cursor-not-allowed disabled:opacity-50`}>
      {busy ? busyLabel : wrong ? "switch to bnb chain" : children}
    </button>
  );
}
