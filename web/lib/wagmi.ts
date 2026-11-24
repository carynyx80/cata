import { createConfig, http, fallback } from "wagmi";
import { bsc } from "wagmi/chains";
import { injected, walletConnect, coinbaseWallet } from "wagmi/connectors";
import type { CreateConnectorFn } from "wagmi";
import { SITE_URL } from "./api";

const wcId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
const rpc = process.env.NEXT_PUBLIC_BSC_RPC_URL;

const connectors: CreateConnectorFn[] = [injected({ shimDisconnect: true })];
if (wcId) {
  connectors.push(walletConnect({
    projectId: wcId,
    showQrModal: true,
    metadata: { name: "Cata", description: "pull something real.", url: SITE_URL, icons: [`${SITE_URL}/icon.svg`] },
  }));
}
connectors.push(coinbaseWallet({ appName: "Cata", appLogoUrl: `${SITE_URL}/icon.svg` }));

export const wagmiConfig = createConfig({
  chains: [bsc],
  connectors,
  ssr: true,
  transports: {
    [bsc.id]: fallback([...(rpc ? [http(rpc)] : []), http("https://bsc-dataseed.binance.org"), http("https://bsc-rpc.publicnode.com"), http()]),
  },
});

declare module "wagmi" {
  interface Register { config: typeof wagmiConfig }
}
