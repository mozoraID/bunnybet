"use client";

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { USDM_ADDRESS, ERC20_ABI, txUrl } from "@/lib/contracts";
import type { Address } from "@/types/market";

/**
 * useUSDM
 * ───────
 * Returns the connected user's USDM balance, and their current allowance for
 * a specific spender (market contract address).
 *
 * Also exposes `approve(spender, amount)` which fires an ERC-20 approve tx
 * and waits for confirmation before resolving.
 */
export function useUSDM(spender?: Address) {
  const { address: userAddress } = useAccount();
  const queryClient = useQueryClient();

  // ── Balance ──────────────────────────────────────────────────────────────
  const { data: balance = 0n, queryKey: balanceKey } = useReadContract({
    address:      USDM_ADDRESS,
    abi:          ERC20_ABI,
    functionName: "balanceOf",
    args:         userAddress ? [userAddress] : undefined,
    query: {
      enabled:         !!userAddress,
      refetchInterval: 3_000,
    },
  });

  // ── Allowance ────────────────────────────────────────────────────────────
  const { data: allowance = 0n, queryKey: allowanceKey } = useReadContract({
    address:      USDM_ADDRESS,
    abi:          ERC20_ABI,
    functionName: "allowance",
    args:         userAddress && spender ? [userAddress, spender] : undefined,
    query: {
      enabled:         !!userAddress && !!spender,
      refetchInterval: 2_000,
    },
  });

  // ── Approve tx ───────────────────────────────────────────────────────────
  const { writeContractAsync, isPending: isApprovePending } = useWriteContract();

  async function approve(spenderAddr: Address, amount: bigint): Promise<boolean> {
    try {
      const hash = await writeContractAsync({
        address:      USDM_ADDRESS,
        abi:          ERC20_ABI,
        functionName: "approve",
        args:         [spenderAddr, amount],
      });

      toast.loading("Approving USDM...", { id: "approve" });

      // Wait inline — wagmi's useWaitForTransactionReceipt is hook-only,
      // so we poll manually here via a small helper.
      await waitForTx(hash);
      toast.success("USDM approved!", { id: "approve" });

      // Bust allowance cache
      queryClient.invalidateQueries({ queryKey: allowanceKey });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Approval failed";
      toast.error(msg.slice(0, 80), { id: "approve" });
      return false;
    }
  }

  return {
    balance:           balance as bigint,
    allowance:         allowance as bigint,
    approve,
    isApprovePending,
  };
}

// ─── Simple tx waiter (polling fallback) ──────────────────────────────────────
async function waitForTx(hash: `0x${string}`, maxMs = 30_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    await sleep(1_200);
    try {
      const res = await fetch(
        `https://megaeth.blockscout.com/api?module=transaction&action=gettxreceiptstatus&txhash=${hash}`
      );
      const json = await res.json();
      if (json?.result?.status === "1") return;
    } catch {}
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
