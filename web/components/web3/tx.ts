"use client";
import { useCallback, useState } from "react";
import { useAccount, useConfig } from "wagmi";
import { readContract, writeContract, waitForTransactionReceipt, simulateContract } from "wagmi/actions";
import { erc20Abi, maxUint256, BaseError, ContractFunctionRevertedError, UserRejectedRequestError, type Abi, type Address, type Hash, type TransactionReceipt } from "viem";
import { cataVaultAbi } from "@/lib/abis";
import { addresses, NATIVE } from "@/lib/contracts";
import { useToasts } from "./Toasts";

export type Write = { address: Address; abi: Abi; functionName: string; args?: readonly unknown[]; value?: bigint };

/** Turn a viem/wallet error into one short lowercase line. */
export function errText(e: unknown): string {
  if (e instanceof BaseError) {
    if (e.walk((x) => x instanceof UserRejectedRequestError)) return "you rejected the request in your wallet";
    const rev = e.walk((x) => x instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
    if (rev) return `reverted: ${rev.data?.errorName ?? rev.reason ?? "unknown"}`.toLowerCase();
    return (e.shortMessage || e.message).split("\n")[0].toLowerCase();
  }
  return (e as Error)?.message?.split("\n")[0]?.toLowerCase() ?? "something went wrong";
}

/**
 * Approve-then-act transaction runner with pending/success/error toasts and BscScan links.
 * `approve` handles ERC20 (USDT/CATA) allowances; `approveNft` handles a vault token for an operator.
 */
export function useTx() {
  const config = useConfig();
  const { address } = useAccount();
  const toasts = useToasts();
  const [busy, setBusy] = useState(false);

  const send = useCallback(async (label: string, w: Write): Promise<TransactionReceipt> => {
    const id = toasts.push({ kind: "pending", title: `${label}…`, detail: "confirm in your wallet" });
    try {
      const { request } = await simulateContract(config, { ...w, account: address } as never);
      const hash: Hash = await writeContract(config, request as never);
      toasts.update(id, { title: `${label} · pending`, detail: "waiting for bnb chain", hash });
      const receipt = await waitForTransactionReceipt(config, { hash });
      if (receipt.status !== "success") throw new Error("transaction reverted");
      toasts.update(id, { kind: "success", title: `${label} · done`, detail: undefined, hash });
      return receipt;
    } catch (e) {
      toasts.update(id, { kind: "error", title: `${label} failed`, detail: errText(e) });
      throw e;
    }
  }, [config, address, toasts]);

  const ensureAllowance = useCallback(async (token: Address, spender: Address, amount: bigint) => {
    if (!address || token === NATIVE || amount === 0n) return;
    const current = await readContract(config, { address: token, abi: erc20Abi, functionName: "allowance", args: [address, spender] });
    if (current >= amount) return;
    await send("approve token", { address: token, abi: erc20Abi as Abi, functionName: "approve", args: [spender, amount > maxUint256 / 2n ? maxUint256 : amount] });
  }, [address, config, send]);

  const ensureNft = useCallback(async (operator: Address, tokenId: bigint) => {
    const vault = addresses.vault;
    if (!address || !vault) return;
    const [approved, all] = await Promise.all([
      readContract(config, { address: vault, abi: cataVaultAbi, functionName: "getApproved", args: [tokenId] }),
      readContract(config, { address: vault, abi: cataVaultAbi, functionName: "isApprovedForAll", args: [address, operator] }),
    ]);
    if (all || (approved as string).toLowerCase() === operator.toLowerCase()) return;
    await send("approve slab", { address: vault, abi: cataVaultAbi as Abi, functionName: "approve", args: [operator, tokenId] });
  }, [address, config, send]);

  const run = useCallback(async (label: string, w: Write, opts: { approve?: { token: Address; amount: bigint }; approveNft?: bigint } = {}) => {
    setBusy(true);
    try {
      if (opts.approve) await ensureAllowance(opts.approve.token, w.address, opts.approve.amount);
      if (opts.approveNft !== undefined) await ensureNft(w.address, opts.approveNft);
      return await send(label, w);
    } finally {
      setBusy(false);
    }
  }, [ensureAllowance, ensureNft, send]);

  return { run, busy, address, config };
}
