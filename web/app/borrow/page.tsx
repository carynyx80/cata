"use client";
import { useState } from "react";
import { useLocation } from "@/lib/hooks";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useAccount, useConfig } from "wagmi";
import { getPublicClient, readContract } from "wagmi/actions";
import { formatUnits, parseUnits, type Abi } from "viem";
import { Slab } from "@/components/Slab";
import { Reveal } from "@/components/Reveal";
import { Page, PageHead, Toggle, input, btnPink, btn } from "@/components/ui";
import { Act } from "@/components/web3/Act";
import { chunkedLogs, loadSlab, useMySlabs } from "@/components/web3/slabs";
import { useTx } from "@/components/web3/tx";
import { cardLendingAbi } from "@/lib/abis";
import { addresses, NATIVE, USDT } from "@/lib/contracts";
import { catalog, fmt, type Card } from "@/lib/data";

const sampleVaulted = catalog.filter((c) => c.inVault);
const LTV = 0.4, LIQ = 0.6, APR = 0.15, BNB = 620;
const assets = ["usdt", "bnb"] as const;
const tokenOf = (a: (typeof assets)[number]) => (a === "bnb" ? NATIVE : USDT);
const n18 = (v: bigint) => Number(formatUnits(v, 18));

/** The wallet's active CardLending loans (Borrowed events → loans(tokenId).active). */
function useMyLoans() {
  const config = useConfig();
  const { address } = useAccount();
  return useQuery({
    queryKey: ["loans", address], enabled: !!address && !!addresses.lending && !!addresses.vault, staleTime: 20_000,
    queryFn: async () => {
      const L = addresses.lending!;
      const client = getPublicClient(config)!;
      const logs = await chunkedLogs(config, (fromBlock, toBlock) => client.getContractEvents({ address: L, abi: cardLendingAbi, eventName: "Borrowed", args: { borrower: address }, fromBlock, toBlock }));
      const ids = [...new Set(logs.map((l) => (l as unknown as { args: { tokenId: bigint } }).args.tokenId))];
      const rows = await Promise.all(ids.map(async (id) => {
        const loan = (await readContract(config, { address: L, abi: cardLendingAbi, functionName: "loans", args: [id] })) as readonly unknown[];
        if (!loan[5]) return null;
        const [debt, slab] = await Promise.all([readContract(config, { address: L, abi: cardLendingAbi, functionName: "debtOf", args: [id] }) as Promise<bigint>, loadSlab(config, id)]);
        return { tokenId: id, token: loan[1] as `0x${string}`, debt, slab };
      }));
      return rows.filter((x) => x !== null);
    },
  });
}

/** Supply side: pool stats, your shares and their value via previewWithdraw. */
function useLendPool(asset: (typeof assets)[number]) {
  const config = useConfig();
  const { address } = useAccount();
  return useQuery({
    queryKey: ["lend", asset, address], enabled: !!addresses.lending, staleTime: 20_000,
    queryFn: async () => {
      const L = addresses.lending!, t = tokenOf(asset);
      const [total, pool] = await Promise.all([
        readContract(config, { address: L, abi: cardLendingAbi, functionName: "totalAssets", args: [t] }) as Promise<bigint>,
        readContract(config, { address: L, abi: cardLendingAbi, functionName: "pools", args: [t] }) as Promise<readonly bigint[]>,
      ]);
      let shares = 0n, value = 0n;
      if (address) {
        shares = (await readContract(config, { address: L, abi: cardLendingAbi, functionName: "sharesOf", args: [t, address] })) as bigint;
        if (shares > 0n) value = (await readContract(config, { address: L, abi: cardLendingAbi, functionName: "previewWithdraw", args: [t, shares] })) as bigint;
      }
      const borrowed = pool[1];
      return { total, util: total > 0n ? Number((borrowed * 10000n) / total) / 100 : 0, shares, value };
    },
  });
}

function LendCard({ a, apy, sup, util, i }: { a: (typeof assets)[number]; apy: string; sup: string; util: string; i: number }) {
  const pool = useLendPool(a);
  const { run, busy } = useTx();
  const [amt, setAmt] = useState("");
  const live = !!pool.data;
  const supply = async () => {
    const t = tokenOf(a), amount = parseUnits(amt || "0", 18);
    if (amount === 0n) return;
    try {
      await run(`supply ${a}`, { address: addresses.lending!, abi: cardLendingAbi as Abi, functionName: "deposit", args: [t, amount], value: a === "bnb" ? amount : undefined }, a === "bnb" ? {} : { approve: { token: t, amount } });
      setAmt(""); pool.refetch();
    } catch { /* toast */ }
  };
  const withdraw = async () => {
    if (!pool.data?.shares) return;
    try { await run(`withdraw ${a}`, { address: addresses.lending!, abi: cardLendingAbi as Abi, functionName: "withdraw", args: [tokenOf(a), pool.data.shares] }); pool.refetch(); } catch { /* toast */ }
  };
  return (
    <Reveal delay={i * .06}>
      <div className="rounded-[32px] bg-surface p-6">
        <div className="flex items-baseline justify-between"><span className="font-display text-3xl">{a}</span><span className="font-mono text-3xl text-pink">{apy}<span className="ml-1 text-xs text-muted">supply apy</span></span></div>
        <div className="mt-4 grid grid-cols-2 gap-3 font-mono text-sm">
          <div className="rounded-2xl bg-cream p-3"><div className="text-[10px] uppercase tracking-widest text-muted">supplied</div>{live ? `${n18(pool.data!.total).toLocaleString("en-US", { maximumFractionDigits: 2 })} ${a}` : sup}</div>
          <div className="rounded-2xl bg-cream p-3"><div className="text-[10px] uppercase tracking-widest text-muted">utilization</div>{live ? `${pool.data!.util.toFixed(0)}%` : util}</div>
        </div>
        {live && <input value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^0-9.]/g, ""))} placeholder={`0 ${a}`} inputMode="decimal" className={`${input} mt-4`} />}
        <Act need={["lending"]} onClick={supply} busy={busy} disabled={live && !(parseFloat(amt) > 0)} className={`${btn} mt-5 w-full`}>supply {a}</Act>
        {live && pool.data!.shares > 0n && (
          <button onClick={withdraw} disabled={busy} className="mt-2 w-full rounded-full border border-ink/20 py-3 font-mono text-xs transition hover:border-ink hover:bg-cream">
            withdraw all · {n18(pool.data!.value).toLocaleString("en-US", { maximumFractionDigits: 4 })} {a}
          </button>
        )}
      </div>
    </Reveal>
  );
}

export default function Borrow() {
  const { isConnected } = useAccount();
  const config = useConfig();
  const mine = useMySlabs();
  const loans = useMyLoans();
  const { run, busy } = useTx();
  const real = !!addresses.lending && !!addresses.vault && isConnected && !!mine.data?.length;
  const vaulted: (Card & { tokenId?: bigint })[] = real ? mine.data!.filter((x) => x.physical) : sampleVaulted;
  const urlToken = useLocation((l) => new URLSearchParams(l.search).get("token"), null);
  const [picked, setSel] = useState<string | null>(null);
  const sel = picked ?? urlToken ?? sampleVaulted[0].id;
  const [asset, setAsset] = useState<(typeof assets)[number]>("usdt");
  const [amt, setAmt] = useState("");
  const c = vaulted.find((v) => v.id === sel) ?? vaulted[0] ?? sampleVaulted[0];
  // max borrow = CardLending.collateralValue × ltvBps
  const maxQ = useQuery({
    queryKey: ["maxBorrow", String(c.tokenId), asset], enabled: real && c.tokenId !== undefined,
    queryFn: async () => {
      const L = addresses.lending!;
      const [[v], ltv] = await Promise.all([
        readContract(config, { address: L, abi: cardLendingAbi, functionName: "collateralValue", args: [c.tokenId!, tokenOf(asset)] }) as Promise<readonly [bigint, bigint]>,
        readContract(config, { address: L, abi: cardLendingAbi, functionName: "ltvBps" }) as Promise<number>,
      ]);
      return (v * BigInt(ltv)) / 10000n;
    },
  });
  const onchainMax = maxQ.data ?? null;
  const borrow = async () => {
    if (c.tokenId === undefined) return;
    try {
      await run(`borrow ${asset}`, { address: addresses.lending!, abi: cardLendingAbi as Abi, functionName: "borrow", args: [c.tokenId, tokenOf(asset), parseUnits(amt, 18)] }, { approveNft: c.tokenId });
      setAmt(""); mine.refetch(); loans.refetch();
    } catch { /* toast */ }
  };
  const repay = async (l: NonNullable<typeof loans.data>[number]) => {
    const L = addresses.lending!;
    try {
      const gross = (await readContract(config, { address: L, abi: cardLendingAbi, functionName: "payQuote", args: [l.tokenId, 600n] })) as bigint;
      await run(`repay ${l.slab.name}`, { address: L, abi: cardLendingAbi as Abi, functionName: "repay", args: [l.tokenId, gross], value: l.token === NATIVE ? gross : undefined },
        l.token === NATIVE ? {} : { approve: { token: l.token, amount: gross } });
      loans.refetch(); mine.refetch();
    } catch { /* toast */ }
  };
  const max = onchainMax !== null ? n18(onchainMax) * (asset === "bnb" ? BNB : 1) : c.value * LTV;
  const want = Math.min(max, Math.max(0, parseFloat(amt) || 0) * (asset === "bnb" ? BNB : 1));
  const used = want / c.value;
  const liqAt = want > 0 ? want / LIQ : 0;
  const show = (usd: number) => asset === "bnb" ? `${(usd / BNB).toFixed(3)} bnb` : `${Math.round(usd).toLocaleString("en-US")} usdt`;
  return (
    <Page>
      <PageHead kicker="borrow" title="your cards, as collateral." sub="lock a vaulted slab, borrow usdt or bnb. repay any time and the card is yours again." />
      <div className="mt-12 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Reveal>
          <div className="rounded-[32px] bg-surface p-6">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted">1 · pick a vaulted slab</div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {vaulted.map((v) => (
                <button key={v.id} onClick={() => { setSel(v.id); setAmt(""); }}
                  className={`rounded-3xl p-2 text-left transition ${c.id === v.id ? "bg-soft ring-2 ring-pink" : "bg-cream hover:bg-soft/50"}`}>
                  <Slab card={v} hover={false} className="!border-[3px] !p-1.5" />
                  <div className="mt-2 truncate px-1 text-xs font-medium">{v.name}</div>
                  <div className="px-1 font-mono text-[11px] text-muted">{fmt(v.value)}</div>
                </button>
              ))}
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[["collateral value", fmt(c.value)], ["max loan · 40% ltv", fmt(max)], ["apr", "15%"]].map(([k, v]) => (
                <div key={k} className="rounded-3xl bg-cream px-5 py-4"><div className="font-mono text-[10px] uppercase tracking-widest text-muted">{k}</div><div className="mt-1 font-mono text-2xl">{v}</div></div>
              ))}
            </div>
          </div>
        </Reveal>
        <Reveal delay={.06}>
          <div className="h-full rounded-[32px] bg-ink p-6 text-surface">
            <div className="font-mono text-[10px] uppercase tracking-widest text-surface/60">2 · borrow</div>
            <div className="mt-4"><Toggle dark options={assets} value={asset} onChange={(a) => { setAsset(a); setAmt(""); }} id="basset" size="sm" /></div>
            <div className="mt-4 flex gap-2">
              <input value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^0-9.]/g, ""))} placeholder={`0 ${asset}`} inputMode="decimal" className={`${input} border-surface/15 bg-surface/5 text-lg text-surface`} />
              <button onClick={() => setAmt(asset === "bnb" ? (max / BNB).toFixed(3) : String(max))} className="rounded-2xl bg-surface/10 px-4 font-mono text-xs hover:bg-surface/20">max</button>
            </div>
            <div className="mt-5">
              <div className="flex justify-between font-mono text-[11px] text-surface/60"><span>loan-to-value</span><span>{(used * 100).toFixed(1)}% / 40% max · liquidation 60%</span></div>
              <div className="relative mt-2 h-2.5 rounded-full bg-surface/10">
                <motion.div className="h-full rounded-full bg-pink" animate={{ width: `${(used / LIQ) * 100}%` }} transition={{ type: "spring", stiffness: 200, damping: 30 }} />
                <div className="absolute top-[-4px] h-[18px] w-0.5 bg-surface/60" style={{ left: `${(LTV / LIQ) * 100}%` }} />
              </div>
            </div>
            <div className="mt-5 space-y-2 font-mono text-sm">
              {[["you receive", show(want)], ["interest / month", show(want * APR / 12)], ["liquidated if card value falls below", want > 0 ? fmt(Math.round(liqAt)) : "—"]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-surface/10 pb-2"><span className="text-surface/60">{k}</span><span>{v}</span></div>
              ))}
            </div>
            <Act need={["lending", "vault"]} onClick={borrow} busy={busy} busyLabel="borrowing…" disabled={want <= 0 || !real} className={`${btnPink} mt-6 w-full`}>borrow {asset}</Act>
            {!real && addresses.lending && <p className="mt-3 font-mono text-[10px] text-surface/50">connect a wallet with a vaulted slab to borrow · sample slabs shown</p>}
          </div>
        </Reveal>
      </div>
      {!!loans.data?.length && (
        <div className="mt-5 rounded-[32px] bg-surface p-6">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted">your loans</div>
          <div className="mt-3 space-y-2">
            {loans.data.map((l) => (
              <div key={String(l.tokenId)} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-cream px-4 py-3">
                <span className="font-medium">{l.slab.name} <span className="font-mono text-xs text-muted">#{String(l.tokenId)}</span></span>
                <span className="font-mono text-sm">owe {n18(l.debt).toLocaleString("en-US", { maximumFractionDigits: 4 })} {l.token === NATIVE ? "bnb" : "usdt"}</span>
                <button onClick={() => repay(l)} disabled={busy} className="rounded-full bg-ink px-5 py-2 text-sm text-surface transition hover:bg-pink disabled:opacity-40">repay & unlock</button>
              </div>
            ))}
          </div>
        </div>
      )}
      <Reveal>
        <div className="mt-5 rounded-[32px] bg-soft p-6 md:p-8">
          <h3 className="font-display text-2xl">how liquidation works, simply.</h3>
          <p className="mt-3 max-w-3xl text-muted">you can borrow up to 40% of your card&apos;s value. if the card&apos;s price drops so far that your loan is worth 60% of it, the loan can be closed: the slab is sold to repay lenders, and anything left over comes back to you. repay early or add another slab to stay safe.</p>
        </div>
      </Reveal>
      <section className="mt-20">
        <Reveal><p className="font-mono text-xs uppercase tracking-[.2em] text-pink">lend</p><h2 className="mt-3 font-display text-[clamp(2rem,4.5vw,3.5rem)] leading-[1]">supply usdt or bnb.</h2>
          <p className="mt-3 max-w-xl text-muted">earn interest from borrowers. every loan is backed by a graded slab in the vault.</p></Reveal>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {([["usdt", "9.8%", "412,300 usdt", "61%"], ["bnb", "6.4%", "318.4 bnb", "47%"]] as const).map(([a, apy, sup, util], i) => (
            <LendCard key={a} a={a} apy={apy} sup={sup} util={util} i={i} />
          ))}
        </div>
      </section>
    </Page>
  );
}
