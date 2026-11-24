import { createPublicClient, createWalletClient, encodeFunctionData, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bsc } from "viem/chains";
import { fileURLToPath } from "node:url";
import { ABIS } from "../chain.js";
import { catalogId, price18 } from "../catalogId.js";
import { Repo } from "../db.js";
import { env } from "../env.js";
import { GRADES } from "../pricing.js";
import { seedIfEmpty } from "../seed/index.js";
import type { Card } from "../types.js";

export interface PriceBatch {
  ids: Hex[];
  prices: bigint[];
  labels: string[]; // "<cardId>:<grade>" for logging
  calldata: Hex;
}

/** Build setPrices batches for every (card, grade) with a known price. */
export function buildBatches(cards: Card[], batchSize = 100): PriceBatch[] {
  const entries: { id: Hex; price: bigint; label: string }[] = [];
  for (const c of cards) for (const g of GRADES) {
    const p = c.prices[g];
    if (p != null && p > 0) entries.push({ id: catalogId(c.id, g), price: price18(p), label: `${c.id}:${g}` });
  }
  const out: PriceBatch[] = [];
  for (let i = 0; i < entries.length; i += batchSize) {
    const chunk = entries.slice(i, i + batchSize);
    const ids = chunk.map((e) => e.id), prices = chunk.map((e) => e.price);
    out.push({ ids, prices, labels: chunk.map((e) => e.label),
      calldata: encodeFunctionData({ abi: ABIS.priceIndex, functionName: "setPrices", args: [ids, prices] }) });
  }
  return out;
}

/** Dry-run unless --send AND ORACLE_PRIVATE_KEY, RPC_URL and CATA_PRICE_INDEX_ADDRESS are all set. */
export async function pushPrices(opts: { send: boolean; batchSize?: number }) {
  const e = env();
  const repo = Repo.open(e.dataDir);
  seedIfEmpty(repo);
  const batches = buildBatches(repo.allCards(), opts.batchSize);
  const total = batches.reduce((n, b) => n + b.ids.length, 0);
  console.log(`prepared ${batches.length} setPrices batches (${total} prices)`);
  const canSend = opts.send && e.oracleKey && e.rpcConfigured && e.contracts.priceIndex;
  if (!canSend) {
    if (opts.send) console.log("not sending: need ORACLE_PRIVATE_KEY, RPC_URL and CATA_PRICE_INDEX_ADDRESS");
    batches.slice(0, 1).forEach((b, i) => console.log(`batch ${i}: first ids`, b.labels.slice(0, 3), `calldata ${b.calldata.slice(0, 74)}...`));
    console.log("dry run: nothing sent");
    return { sent: 0, batches };
  }
  const account = privateKeyToAccount(e.oracleKey as Hex);
  const transport = http(e.rpcUrl);
  const wallet = createWalletClient({ account, chain: bsc, transport });
  const pub = createPublicClient({ chain: bsc, transport });
  let sent = 0;
  for (const b of batches) {
    const hash = await wallet.writeContract({ address: e.contracts.priceIndex!, abi: ABIS.priceIndex, functionName: "setPrices", args: [b.ids, b.prices] });
    const rcpt = await pub.waitForTransactionReceipt({ hash });
    console.log(`batch sent ${hash} status=${rcpt.status}`);
    sent++;
  }
  return { sent, batches };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  pushPrices({ send: process.argv.includes("--send") }).catch((err) => { console.error(err); process.exit(1); });
}
