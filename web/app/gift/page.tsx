"use client";
import { useState } from "react";
import { useLocation } from "@/lib/hooks";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { readContract } from "wagmi/actions";
import { decodeEventLog, encodeAbiParameters, keccak256, parseUnits, type Abi, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { Reveal } from "@/components/Reveal";
import { Page, PageHead, PayToggle, input, btnPink, btn, type Pay } from "@/components/ui";
import { Act } from "@/components/web3/Act";
import { PackReveal, type Pending } from "@/components/web3/PackReveal";
import { useTx } from "@/components/web3/tx";
import { giftPacksAbi, packMachineAbi } from "@/lib/abis";
import { addresses, CHAIN_ID, payToken } from "@/lib/contracts";
import { api, SITE_URL, type ApiPool } from "@/lib/api";

const tiers = [["starter", 25], ["collector", 50], ["grail", 250]] as const;

/** Parse a claim link (…/gift?g=<id>#k=<key>) or a bare "<id>#<key>" code. */
function parseClaim(s: string): { giftId: bigint; key: Hex } | null {
  const id = s.match(/[?&]g=(\d+)/)?.[1] ?? s.match(/^\s*(\d+)\s*#/)?.[1];
  const key = s.match(/0x[0-9a-fA-F]{64}/)?.[0];
  return id && key ? { giftId: BigInt(id), key: key as Hex } : null;
}

export default function Gift() {
  const [tier, setTier] = useState(1);
  const [pay, setPay] = useState<Pay>("usdt");
  const [code, setCode] = useState<string | null>(null);
  const [typed, setClaim] = useState<string | null>(null);
  // a claim link opens this page with ?g=<giftId>#k=<key>; the key never leaves the fragment
  const fromUrl = useLocation((l) => (parseClaim(l.href) ? l.href : ""), "");
  const claim = typed ?? fromUrl;
  const [claimed, setClaimed] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const { run, busy, address, config } = useTx();
  const live = !!addresses.giftPacks && !!addresses.packMachine;
  const pools = useQuery({ queryKey: ["pools"], queryFn: () => api<{ items: ApiPool[] }>("/pools"), retry: 1, staleTime: 30_000 });
  const chainPools = pools.data?.items?.some((p) => p.source === "chain") ? pools.data.items : undefined;
  const pool = chainPools?.find((p) => p.name.toLowerCase().includes(tiers[tier][0])) ?? chainPools?.[tier];
  const price = pool?.priceUsd ?? tiers[tier][1];

  const buyGift = async () => {
    const gp = addresses.giftPacks!, pm = addresses.packMachine!;
    const token = payToken(pay)!;
    const poolId = BigInt(pool?.id ?? tier);
    const key = generatePrivateKey();
    const signer = privateKeyToAccount(key).address; // only the address goes on-chain
    try {
      const quote = (await readContract(config, { address: pm, abi: packMachineAbi, functionName: "quote", args: [poolId, token] })) as bigint;
      const receipt = await run(`buy ${tiers[tier][0]} gift`, {
        address: gp, abi: giftPacksAbi as Abi, functionName: "buyGift",
        args: [poolId, token, signer, parseUnits((price * 1.01).toFixed(6), 18)], value: pay === "bnb" ? (quote * 101n) / 100n : undefined,
      }, pay === "bnb" ? {} : { approve: { token, amount: quote } });
      for (const log of receipt.logs) {
        try {
          const ev = decodeEventLog({ abi: giftPacksAbi, data: log.data, topics: log.topics });
          if (ev.eventName === "GiftCreated") setCode(`${SITE_URL}/gift?g=${ev.args.giftId}#k=${key}`);
        } catch { /* other event */ }
      }
    } catch { /* toast */ }
  };

  const claimGift = async () => {
    const c = parseClaim(claim);
    if (!c || !address || !addresses.giftPacks) return;
    const gp = addresses.giftPacks;
    // matches GiftPacks.claimDigest: eth-signed keccak256(abi.encode(this, chainid, giftId, recipient))
    const inner = keccak256(encodeAbiParameters(
      [{ type: "address" }, { type: "uint256" }, { type: "uint256" }, { type: "address" }], [gp, BigInt(CHAIN_ID), c.giftId, address]));
    const signature = await privateKeyToAccount(c.key).signMessage({ message: { raw: inner } });
    try {
      const receipt = await run("claim gift", { address: gp, abi: giftPacksAbi as Abi, functionName: "claim", args: [c.giftId, address, signature] });
      const g = (await readContract(config, { address: gp, abi: giftPacksAbi, functionName: "gifts", args: [c.giftId] })) as { creditId: bigint };
      setClaimed(true);
      setPending({ creditId: g.creditId, pool: "gift", fromBlock: receipt.blockNumber });
      if (window.location.hash) history.replaceState(null, "", window.location.pathname);
    } catch { /* toast */ }
  };
  return (
    <Page>
      <PageHead kicker="gift a pack" title="send an unopened rip." sub="pay for a pack, get a claim link. they open it — the pull is theirs." />
      <div className="mt-12 grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Reveal>
          <div className="rounded-[32px] bg-surface p-6 md:p-8">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted">1 · choose a tier</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {tiers.map(([n, p], i) => (
                <button key={n} onClick={() => { setTier(i); setCode(null); }}
                  className={`rounded-3xl p-5 text-left transition ${tier === i ? "bg-ink text-surface" : "bg-cream hover:bg-soft/60"}`}>
                  <div className="font-mono text-[10px] uppercase tracking-widest opacity-70">{n}</div>
                  <div className="mt-3 font-display text-4xl">${p}</div>
                </button>
              ))}
            </div>
            <div className="mt-6 font-mono text-[10px] uppercase tracking-widest text-muted">2 · pay</div>
            <div className="mt-3"><PayToggle value={pay} onChange={setPay} id="gpay" noCata /></div>
            <Act need={["giftPacks", "packMachine"]} onClick={buyGift} busy={busy} busyLabel="buying…" className={`${btnPink} mt-6`}>pay ${price.toLocaleString("en-US")} in {pay} & get link</Act>
            <AnimatePresence>
              {code && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="mt-6 rounded-3xl bg-soft p-5">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-deep">3 · send this · anyone with the link can claim</div>
                    <div className="mt-2 break-all font-mono text-sm">{code}</div>
                    <button onClick={() => navigator.clipboard?.writeText(code)} className={`${btn} mt-4 py-2 text-sm`}>copy link</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Reveal>
        <Reveal delay={.06}>
          <div className="h-full rounded-[32px] bg-ink p-6 text-surface md:p-8">
            <div className="font-mono text-[10px] uppercase tracking-widest text-surface/60">got a gift?</div>
            <h3 className="mt-3 font-display text-3xl">claim a gift.</h3>
            <p className="mt-2 text-surface/60">paste your link. we rip it on-chain and the pull lands in your vault.</p>
            <input value={claim} onChange={(e) => { setClaim(e.target.value.trim()); setClaimed(false); }} placeholder="https://catapacks.xyz/gift?g=…#k=…" className={`${input} mt-6 border-surface/15 bg-surface/5 text-surface`} />
            <Act need={["giftPacks"]} disabled={!parseClaim(claim)} busy={busy} busyLabel="claiming…" onClick={claimGift} className={`${btnPink} mt-4 w-full`}>claim pack</Act>
            {claimed && <p className="mt-4 font-mono text-xs text-soft">claimed · vrf is ripping your pack</p>}
            {!live && claim && <p className="mt-4 font-mono text-xs text-soft">gift packs launch with the contracts</p>}
          </div>
        </Reveal>
      </div>
      <PackReveal key={pending ? String(pending.creditId) : "none"} pending={pending} onClose={() => setPending(null)} />
    </Page>
  );
}
