import { isAddress, type Address } from "viem";

function addr(v: string | undefined): Address | null {
  return v && isAddress(v) ? (v as Address) : null;
}
/** Default browser origins: the production site plus local web dev servers. CORS_ORIGIN overrides (comma-separated, `*` for any). */
export const DEFAULT_CORS_ORIGINS = "https://catapacks.xyz,https://www.catapacks.xyz,http://localhost:3000,http://localhost:3100";
const bool = (v: string | undefined) => v === "true" || v === "1";

/** Read env lazily so tests can mutate process.env. */
export function env() {
  const e = process.env;
  return {
    port: Number(e.PORT ?? 8787),
    corsOrigin: e.CORS_ORIGIN || DEFAULT_CORS_ORIGINS,
    dataDir: e.DATA_DIR || "./data",
    host: e.HOST || "0.0.0.0",
    adminToken: e.ADMIN_TOKEN || null,
    anthropicKey: e.ANTHROPIC_API_KEY || null,
    rpcUrl: e.RPC_URL || "https://bsc-dataseed.binance.org",
    rpcConfigured: !!e.RPC_URL,
    oracleKey: e.ORACLE_PRIVATE_KEY || null,
    cataToken: addr(e.CATA_TOKEN),
    vaultDeployBlock: BigInt(e.VAULT_DEPLOY_BLOCK || 0),
    vaultLogChunk: BigInt(e.VAULT_LOG_CHUNK || 5000),
    contracts: {
      cataConfig: addr(e.CATA_CONFIG_ADDRESS),
      vault: addr(e.CATA_VAULT_ADDRESS),
      packMachine: addr(e.PACK_MACHINE_ADDRESS),
      marketplace: addr(e.MARKETPLACE_ADDRESS),
      treasury: addr(e.CATA_TREASURY_ADDRESS),
      priceIndex: addr(e.CATA_PRICE_INDEX_ADDRESS),
      points: addr(e.CATA_POINTS_ADDRESS),
      liveRips: addr(e.LIVE_RIPS_ADDRESS),
      lending: addr(e.LENDING_ADDRESS),
      giftPacks: addr(e.GIFT_PACKS_ADDRESS),
      predictionMarkets: addr(e.PREDICTION_MARKETS_ADDRESS),
    },
    features: {
      packBattles: bool(e.FEATURE_PACK_BATTLES),
      fractional: bool(e.FEATURE_FRACTIONAL),
      predictions: bool(e.FEATURE_PREDICTIONS),
    },
  };
}
export type Env = ReturnType<typeof env>;
