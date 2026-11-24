"use client";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Slab } from "@/components/Slab";
import { Reveal } from "@/components/Reveal";
import { useQuery } from "@tanstack/react-query";
import { useConfig } from "wagmi";
import { readContract } from "wagmi/actions";
import { formatUnits, type Abi, type Address } from "viem";
import { Page, PageHead, PayToggle, Toggle, btnPink, type Pay } from "@/components/ui";
import { Act } from "@/components/web3/Act";
import { ListModal } from "@/components/web3/ListModal";
import { useCata } from "@/components/web3/Providers";
import { loadSlab, type Slabbed } from "@/components/web3/slabs";
import { useTx } from "@/components/web3/tx";
import { cataMarketAbi } from "@/lib/abis";
import { addresses, NATIVE, USDT, short } from "@/lib/contracts";
import { catalog, fmt, games, type Game } from "@/lib/data";

const BNB = 620;
const sorts = ["newest", "price ↑", "price ↓"] as const;
const listings = catalog.map((c, i) => ({ ...c, price: Math.round(c.value * (0.92 + ((i * 37) % 17) / 100)), seller: `0x${(9134 + i * 773).toString(16)}…${(41 + i * 13).toString(16)}`, age: i }));

type OnchainListing = { id: bigint; seller: Address; token: Address; price: bigint; slab: Slabbed };

/** Active CataMarket listings (scans the newest 120 ids). */
function useListings() {
  const config = useConfig();
  return useQuery({
    queryKey: ["listings"], enabled: !!addresses.market && !!addresses.vault, staleTime: 20_000,
    queryFn: async () => {
      const m = addresses.market!;
      const next = (await readContract(config, { address: m, abi: cataMarketAbi, functionName: "nextListingId" })) as bigint;
      const ids: bigint[] = [];
      for (let i = next - 1n; i >= 1n && ids.length < 120; i--) ids.push(i);
      const rows = await Promise.all(ids.map((id) => readContract(config, { address: m, abi: cataMarketAbi, functionName: "listings", args: [id] })));
      const active = ids.map((id, i) => ({ id, r: rows[i] as readonly [Address, bigint, Address, bigint, boolean] })).filter((x) => x.r[4]);
      return Promise.all(active.map(async ({ id, r }) => ({ id, seller: r[0], token: r[2], price: r[3], slab: await loadSlab(config, r[1]) }) as OnchainListing));
    },
  });
}

export default function Market() {
  const [listOpen, setListOpen] = useState(false);
  const { run, busy, address } = useTx();
  const { token: cata } = useCata();
  const chain = useListings();
  const unit = (t: Address) => (t === NATIVE ? "bnb" : t.toLowerCase() === USDT.toLowerCase() ? "usdt" : "$cata");
  const buy = async (l: OnchainListing) => {
    try {
      await run(`buy ${l.slab.name}`, { address: addresses.market!, abi: cataMarketAbi as Abi, functionName: "buy", args: [l.id], value: l.token === NATIVE ? l.price : undefined },
        l.token === NATIVE ? {} : { approve: { token: l.token, amount: l.price } });
      chain.refetch();
    } catch { /* toast */ }
  };
  const cancel = async (l: OnchainListing) => {
    try { await run("cancel listing", { address: addresses.market!, abi: cataMarketAbi as Abi, functionName: "cancel", args: [l.id] }); chain.refetch(); } catch { /* toast */ }
  };
  const live = !!chain.data?.length;

  const [pay, setPay] = useState<Pay>("bnb");
  const [sort, setSort] = useState<(typeof sorts)[number]>("newest");
  const [game, setGame] = useState<Game | "all">("all");
  const [physical, setPhysical] = useState(false);
  const list = useMemo(() => {
    const l = listings.filter((c) => (game === "all" || c.game === game) && (!physical || !c.digital));
    return [...l].sort((a, b) => sort === "price ↑" ? a.price - b.price : sort === "price ↓" ? b.price - a.price : a.age - b.age);
  }, [sort, game, physical]);
  const show = (usd: number) => pay === "bnb" ? `${(usd / BNB).toFixed(3)} bnb` : `${usd.toLocaleString("en-US")} usdt`;
  return (
    <Page>
      <PageHead kicker="market" title="slabs for sale." sub="peer to peer. every sale settles on-chain, 0.2% burns $cata.">
        <Act need={["market", "vault"]} onClick={() => setListOpen(true)} className={btnPink}>list a card →</Act>
      </PageHead>
      <div className="mt-10 flex flex-col gap-3 rounded-[28px] bg-surface p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {(["all", ...games] as const).map((g) => (
            <button key={g} onClick={() => setGame(g)} className={`rounded-full px-4 py-2 text-sm transition ${game === g ? "bg-ink text-surface" : "bg-cream text-muted hover:text-ink"}`}>{g}</button>
          ))}
          <button onClick={() => setPhysical(!physical)} className={`rounded-full px-4 py-2 text-sm transition ${physical ? "bg-pink text-surface" : "bg-cream text-muted hover:text-ink"}`}>physical only</button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="pl-2 font-mono text-[10px] uppercase tracking-widest text-muted">pay in</span>
          <PayToggle value={pay} onChange={setPay} id="mpay" size="sm" />
          <Toggle options={sorts} value={sort} onChange={setSort} id="msort" size="sm" />
        </div>
      </div>
      {live && (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {chain.data!.map((l) => {
            const mine = address && l.seller.toLowerCase() === address.toLowerCase();
            const amt = Number(formatUnits(l.price, 18));
            return (
              <div key={String(l.id)} className="rounded-[32px] bg-surface p-4 transition-shadow hover:shadow-[0_30px_60px_-30px_rgba(43,26,34,.4)]">
                <Slab card={l.slab} />
                <div className="mt-4 px-1">
                  <div className="truncate font-medium">{l.slab.name}</div>
                  <div className="truncate font-mono text-xs text-muted">{l.slab.grader} {l.slab.grade} · token #{String(l.slab.tokenId)}</div>
                  <div className="mt-3 flex items-end justify-between">
                    <div><div className="font-mono text-xl">{amt.toLocaleString("en-US", { maximumFractionDigits: 4 })} {unit(l.token)}</div>{l.slab.valueUsd ? <div className="font-mono text-[11px] text-muted">index {fmt(l.slab.valueUsd)}</div> : null}</div>
                    <div className="font-mono text-[10px] text-muted">{mine ? "you" : short(l.seller)}</div>
                  </div>
                </div>
                {mine
                  ? <Act need={["market"]} onClick={() => cancel(l)} busy={busy} className="mt-4 w-full rounded-full border border-ink/20 py-2.5 transition hover:border-ink hover:bg-cream">cancel listing</Act>
                  : <Act need={["market"]} onClick={() => buy(l)} busy={busy} disabled={unit(l.token) === "$cata" && !cata} className="mt-4 w-full rounded-full bg-ink py-2.5 text-surface transition hover:bg-pink">buy now</Act>}
              </div>
            );
          })}
        </div>
      )}
      {!live && <motion.div layout className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {list.map((c, i) => (
          <motion.div key={c.id} layout transition={{ type: "spring", stiffness: 300, damping: 30 }}>
            <Reveal delay={(i % 4) * .05}>
              <div className="rounded-[32px] bg-surface p-4 transition-shadow hover:shadow-[0_30px_60px_-30px_rgba(43,26,34,.4)]">
                <Slab card={c} />
                <div className="mt-4 px-1">
                  <div className="truncate font-medium">{c.name}</div>
                  <div className="truncate font-mono text-xs text-muted">{c.grader} {c.grade} · {c.set}</div>
                  <div className="mt-3 flex items-end justify-between">
                    <div><div className="font-mono text-xl">{show(c.price)}</div><div className="font-mono text-[11px] text-muted">≈ {fmt(c.price)}</div></div>
                    <div className="font-mono text-[10px] text-muted">{c.seller}</div>
                  </div>
                </div>
                <Act need={["market"]} onClick={() => {}} disabled soonLabel={addresses.market ? "sample listing" : undefined} className="mt-4 w-full rounded-full bg-ink py-2.5 text-surface transition hover:bg-pink">buy now</Act>
              </div>
            </Reveal>
          </motion.div>
        ))}
      </motion.div>}
      <ListModal open={listOpen} onClose={() => setListOpen(false)} onListed={() => chain.refetch()} />
    </Page>
  );
}
