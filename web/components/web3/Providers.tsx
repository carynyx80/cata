"use client";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { WagmiProvider, useReadContract } from "wagmi";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { zeroAddress, isAddress, type Address } from "viem";
import { wagmiConfig } from "@/lib/wagmi";
import { addresses } from "@/lib/contracts";
import { cataConfigAbi } from "@/lib/abis";
import { api, type ApiConfig } from "@/lib/api";
import { ToastProvider } from "./Toasts";
import { ConnectModal } from "./ConnectModal";

type Ui = { openConnect: () => void; closeConnect: () => void; connectOpen: boolean };
const UiCtx = createContext<Ui>({ openConnect: () => {}, closeConnect: () => {}, connectOpen: false });
export const useWalletUi = () => useContext(UiCtx);

type Cata = { token: Address | null; active: boolean };
const CataCtx = createContext<Cata>({ token: null, active: false });
/** $CATA activation: CataConfig.cataToken() on-chain, falling back to the backend's GET /config. */
export const useCata = () => useContext(CataCtx);

function CataProvider({ children }: { children: ReactNode }) {
  const chain = useReadContract({
    address: addresses.config, abi: cataConfigAbi, functionName: "cataToken",
    query: { enabled: !!addresses.config, refetchInterval: 60_000 },
  });
  const backend = useQuery({
    queryKey: ["config"], queryFn: () => api<ApiConfig>("/config"),
    staleTime: 60_000, retry: 1, refetchOnWindowFocus: false,
  });
  const value = useMemo<Cata>(() => {
    const onchain = chain.data as Address | undefined;
    const fromApi = backend.data?.cataToken;
    const t = onchain && onchain !== zeroAddress ? onchain : fromApi && isAddress(fromApi) && fromApi !== zeroAddress ? (fromApi as Address) : null;
    return { token: t, active: !!t };
  }, [chain.data, backend.data]);
  return <CataCtx.Provider value={value}>{children}</CataCtx.Provider>;
}

export function Providers({ children }: { children: ReactNode }) {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } }));
  const [connectOpen, setOpen] = useState(false);
  const openConnect = useCallback(() => setOpen(true), []);
  const closeConnect = useCallback(() => setOpen(false), []);
  const ui = useMemo(() => ({ openConnect, closeConnect, connectOpen }), [openConnect, closeConnect, connectOpen]);
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={qc}>
        <CataProvider>
          <ToastProvider>
            <UiCtx.Provider value={ui}>
              {children}
              <ConnectModal />
            </UiCtx.Provider>
          </ToastProvider>
        </CataProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
