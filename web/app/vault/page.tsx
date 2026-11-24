"use client";
import { useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import type { Abi } from "viem";
import { Slab } from "@/components/Slab";
import { Reveal } from "@/components/Reveal";
import { Act } from "@/components/web3/Act";
import { ListModal } from "@/components/web3/ListModal";
import { useWalletUi } from "@/components/web3/Providers";
import { useMySlabs } from "@/components/web3/slabs";
import { useTx } from "@/components/web3/tx";
import { cataVaultAbi } from "@/lib/abis";
import { addresses } from "@/lib/contracts";
import { cards, fmt, type Card } from "@/lib/data";

type Row = Card & { tokenId?: bigint };

export default function Vault() {
  const { isConnected } = useAccount();
  const { openConnect } = useWalletUi();
  const mine = useMySlabs();
  const { run, busy } = useTx();
  const [listing, setListing] = useState<bigint | undefined>();
  const [listOpen, setListOpen] = useState(false);
  const real = !!addresses.vault && isConnected;
  const rows: Row[] = real ? (mine.data ?? []) : cards;
  const total = rows.reduce((s, c) => s + c.value, 0);

  const ship = async (c: Row) => {
    if (c.tokenId === undefined || !addresses.vault) return;
    if (!window.confirm(`burn ${c.name} (token #${c.tokenId}) and ship the physical slab to you? this can't be undone.`)) return;
    try { await run("ship to me", { address: addresses.vault, abi: cataVaultAbi as Abi, functionName: "burnForRedeem", args: [c.tokenId] }); mine.refetch(); } catch { /* toast */ }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pt-16 md:px-8">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="font-mono text-xs uppercase tracking-[.2em] text-pink">vault</p>
            <h1 className="mt-4 font-display text-[clamp(2.8rem,7vw,6rem)] leading-[.95]">your slabs.</h1>
          </div>
          <div className="flex gap-3">
            {[["slabs", String(rows.length)], ["vault value", fmt(total)], ["borrowable", fmt(Math.round(total * .4))]].map(([k, v]) => (
              <div key={k} className="rounded-3xl bg-surface px-6 py-4">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted">{k}</div>
                <div className="mt-1 font-mono text-2xl">{v}</div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
      {!real && (
        <div className="mt-8 font-mono text-xs text-muted">
          {addresses.vault ? <><button onClick={openConnect} className="text-pink underline-offset-2 hover:underline">connect a wallet</button> to see your slabs · showing sample slabs</> : "sample slabs · vault contract launching soon"}
        </div>
      )}
      {real && mine.isLoading && <div className="mt-8 font-mono text-xs text-muted">reading your vault from bnb chain…</div>}
      {real && mine.data?.length === 0 && (
        <div className="mt-10 rounded-[32px] bg-surface p-10 text-center text-muted">no slabs yet. <Link href="/packs" className="text-pink hover:underline">open a pack →</Link></div>
      )}
      <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map((c, i) => (
          <Reveal key={c.id} delay={(i % 4) * .06}>
            <div className="rounded-[32px] bg-surface p-4 transition-shadow hover:shadow-[0_30px_60px_-30px_rgba(43,26,34,.4)]">
              <Slab card={c} />
              <div className="mt-4 px-1">
                <div className="truncate font-medium">{c.name}</div>
                <div className="flex justify-between font-mono text-xs text-muted">
                  <span>{c.grader} {c.grade} · {c.tokenId !== undefined ? `token #${c.tokenId}` : c.set}</span>
                </div>
                <div className="mt-2 font-mono text-xl">{c.value ? fmt(c.value) : "—"}</div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                <Act need={["market", "vault"]} onClick={() => { setListing(c.tokenId); setListOpen(true); }} className="w-full rounded-full bg-ink py-2 text-surface transition hover:bg-pink">list</Act>
                <Act need={["vault"]} onClick={() => ship(c)} busy={busy} busyLabel="…" disabled={c.tokenId === undefined || c.digital} className="w-full rounded-full border border-ink/20 py-2 transition hover:border-ink hover:bg-cream">ship to me</Act>
                <Link href={c.tokenId !== undefined ? `/borrow?token=${c.tokenId}` : "/borrow"} className="rounded-full border border-ink/20 py-2 text-center transition hover:border-ink hover:bg-cream">borrow</Link>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
      <ListModal open={listOpen} onClose={() => setListOpen(false)} preselect={listing} onListed={() => mine.refetch()} />
    </div>
  );
}
