import { zeroAddress, isAddress, type Address } from "viem";

/** Contract addresses on BNB Chain (56). Each is optional: missing = "contracts launching soon". */
const env = (v: string | undefined): Address | undefined => (v && isAddress(v) && v !== zeroAddress ? (v as Address) : undefined);

// NEXT_PUBLIC_* must be referenced literally so Next inlines them at build time.
export const addresses = {
  config: env(process.env.NEXT_PUBLIC_CATA_CONFIG),
  packMachine: env(process.env.NEXT_PUBLIC_PACK_MACHINE),
  vault: env(process.env.NEXT_PUBLIC_CATA_VAULT),
  market: env(process.env.NEXT_PUBLIC_CATA_MARKET),
  giftPacks: env(process.env.NEXT_PUBLIC_GIFT_PACKS),
  points: env(process.env.NEXT_PUBLIC_CATA_POINTS),
  setRewards: env(process.env.NEXT_PUBLIC_SET_REWARDS),
  priceIndex: env(process.env.NEXT_PUBLIC_PRICE_INDEX),
  prediction: env(process.env.NEXT_PUBLIC_PREDICTION_MARKET),
  lending: env(process.env.NEXT_PUBLIC_CARD_LENDING),
  liveRips: env(process.env.NEXT_PUBLIC_LIVE_RIPS),
  battles: env(process.env.NEXT_PUBLIC_PACK_BATTLES),
  fractional: env(process.env.NEXT_PUBLIC_FRACTIONAL_GRAILS),
  treasury: env(process.env.NEXT_PUBLIC_CATA_TREASURY),
} as const;
export type ContractKey = keyof typeof addresses;

export const USDT: Address = "0x55d398326f99059fF775485246999027B3197955";
export const NATIVE: Address = zeroAddress;
export const CHAIN_ID = 56;
/** First block to scan for vault Transfer logs (set to the vault deploy block). */
export const VAULT_DEPLOY_BLOCK = BigInt(process.env.NEXT_PUBLIC_VAULT_DEPLOY_BLOCK || "0");

export const has = (...keys: ContractKey[]) => keys.every((k) => !!addresses[k]);
export const launched = (...keys: ContractKey[]) => has(...keys);

export const bscscanTx = (hash: string) => `https://bscscan.com/tx/${hash}`;
export const bscscanAddr = (a: string) => `https://bscscan.com/address/${a}`;
export const pancakeBuy = (token: string) => `https://pancakeswap.finance/swap?chain=bsc&outputCurrency=${token}`;
export const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

/** Map the UI pay option to a token address (bnb → native, usdt → USDT, $cata → CATA when live). */
export function payToken(pay: string, cata?: Address | null): Address | undefined {
  if (pay === "bnb") return NATIVE;
  if (pay === "usdt") return USDT;
  if (pay === "$cata") return cata ?? undefined;
  return undefined;
}
