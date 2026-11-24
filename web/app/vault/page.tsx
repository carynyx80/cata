"use client";
import { useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import type { Abi } from "viem";
import { Slab } from "@/components/Slab";
import { Reveal } from "@/components/Reveal";
import { Act } from "@/components/web3/Act";
import dynamic from "next/dynamic";
import { useWalletUi } from "@/components/web3/Providers";
import { useMySlabs } from "@/components/web3/slabs";
import { useTx } from "@/components/web3/tx";
import { cataVaultAbi } from "@/lib/abis";
import { addresses } from "@/lib/contracts";
import { cards, fmt, type Card } from "@/lib/data";

type Row = Card & { tokenId?: bigint };
const ListModal = dynamic(() => import("@/components/web3/ListModal").then((m) => m.ListModal), { ssr: false });

export default function Vault() {
  const { isConnected } = useAccount();
  const { openConnect } = useWalletUi();
  const mine = useMySlabs();
  const { run, busy } = useTx();
  const [listing, setListing] = useState<bigint | undefined>();
  const [listOpen, setListOpen] = useState(false);
  const [listUsed, setListUsed] = useState(false);
  const real = !!addresses.vault && isConnected;
  const rows: Row[] = real ? (mine.data ?? []) : cards;
  const total = rows.reduce((s, c) => s + c.value, 0);

  const ship = async (c: Row) => {
    if (c.tokenId === undefined || !addresses.vault) return;
    if (!window.confirm(`burn ${c.name} (token #${c.tokenId}) and ship the physical slab to you? this can't be undone.`)) return;
    try { await run("ship to me", { address: addresses.vault, abi: cataVaultAbi as Abi, functionName: "burnForRedeem", args: [c.tokenId] }); mine.refetch(); } catch { /* toast */ }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pt-10 sm:pt-16 md:px-8">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0">
            <p className="font-mono text-xs uppercase tracking-[.2em] text-pink">vault</p>
            <h1 className="mt-4 font-display text-[clamp(2.4rem,9vw,6rem)] leading-[.95]">your slabs.</h1>
          </div>
          <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:gap-3">
            {[["slabs", String(rows.length)], ["vault value", fmt(total)], ["borrowable", fmt(Math.round(total * .4))]].map(([k, v]) => (
              <div key={k} className="min-w-0 rounded-3xl bg-surface px-3 py-3 sm:px-6 sm:py-4">
                <div className="truncate font-mono text-[10px] uppercase tracking-widest text-muted">{k}</div>
                <div className="mt-1 truncate font-mono text-lg sm:text-2xl">{v}</div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
      {!real && (
        <div className="mt-8 font-mono text-xs text-muted">
          {addresses.vault ? <><button onClick={openConnect} className="text-pink underline-offset-2 hover:underline pointer-coarse:min-h-11">connect a wallet</button> to see your slabs · showing sample slabs</> : "sample slabs · vault contract launching soon"}
        </div>
      )}
      {real && mine.isLoading && <div className="mt-8 font-mono text-xs text-muted">reading your vault from bnb chain…</div>}
      {real && mine.data?.length === 0 && (
        <div className="mt-10 rounded-[32px] bg-surface p-10 text-center text-muted">no slabs yet. <Link href="/packs" className="text-pink hover:underline">open a pack →</Link></div>
      )}
      <div className="mt-10 grid grid-cols-1 gap-5 min-[480px]:grid-cols-2 sm:mt-14 sm:gap-6 lg:grid-cols-4">
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
                <Act need={["market", "vault"]} onClick={() => { setListing(c.tokenId); setListUsed(true); setListOpen(true); }} className="min-h-10 w-full rounded-full bg-ink px-1 py-2 text-surface pointer-coarse:min-h-11 transition hover:bg-pink">list</Act>
                <Act need={["vault"]} onClick={() => ship(c)} busy={busy} busyLabel="…" disabled={c.tokenId === undefined || c.digital} className="min-h-10 w-full whitespace-nowrap rounded-full border border-ink/20 px-1 py-2 transition hover:border-ink hover:bg-cream pointer-coarse:min-h-11">ship<span className="max-[379px]:hidden"> to me</span></Act>
                <Link href={c.tokenId !== undefined ? `/borrow?token=${c.tokenId}` : "/borrow"} className="flex min-h-10 items-center justify-center rounded-full border border-ink/20 px-1 py-2 transition hover:border-ink hover:bg-cream pointer-coarse:min-h-11">borrow</Link>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
      {listUsed && <ListModal open={listOpen} onClose={() => setListOpen(false)} preselect={listing} onListed={() => mine.refetch()} />}
    </div>
  );
}
