"use client";

import { useQuery, useQueryClient }  from "@tanstack/react-query";
import { usePublicClient, useAccount, useWriteContract } from "wagmi";
import { useState }       from "react";
import toast              from "react-hot-toast";
import { VAULT_ADDRESS, VAULT_ABI, USDM_ADDRESS, ERC20_ABI, txUrl } from "@/lib/contracts";
import { parseUSDMSafe }  from "@/lib/utils";
import type { Address }   from "@/types/market";

export function useVaultBalance() {
  const { address } = useAccount();
  const client      = usePublicClient();

  return useQuery({
    queryKey: ["vaultBalance", address],
    queryFn: async () => {
      if (!client || !address) return { vaultBalance: 0n, walletBalance: 0n, allowance: 0n };
      try {
        const [vaultBalance, walletBalance, allowance] = await Promise.all([
          client.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "balance",   args: [address] }) as Promise<bigint>,
          client.readContract({ address: USDM_ADDRESS,  abi: ERC20_ABI, functionName: "balanceOf", args: [address] }) as Promise<bigint>,
          client.readContract({ address: USDM_ADDRESS,  abi: ERC20_ABI, functionName: "allowance", args: [address, VAULT_ADDRESS] }) as Promise<bigint>,
        ]);
        return { vaultBalance, walletBalance, allowance };
      } catch { return { vaultBalance: 0n, walletBalance: 0n, allowance: 0n }; }
    },
    refetchInterval: 3_000,
    retry:           1,
    enabled: !!address && !!client,
  });
}

export function useVaultPosition(marketAddress: Address | undefined) {
  const { address } = useAccount();
  const client      = usePublicClient();

  return useQuery({
    queryKey: ["vaultPosition", address, marketAddress],
    queryFn: async () => {
      if (!client || !address || !marketAddress) return null;
      try {
        const r = await client.readContract({
          address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "getUserPosition", args: [address, marketAddress],
        }) as [bigint, bigint, bigint, boolean];
        return { yesShares: r[0], noShares: r[1], estimatedPayout: r[2], hasClaimed: r[3] };
      } catch { return null; }
    },
    refetchInterval: 3_000,
    retry:           1,
    enabled: !!address && !!marketAddress && !!client,
  });
}

export function useVaultActions() {
  const qc = useQueryClient();
  const { address } = useAccount();
  const [isApproving, setIsApproving] = useState(false);
  const { writeContractAsync } = useWriteContract();

  const bust = () => {
    qc.invalidateQueries({ queryKey: ["vaultBalance", address] });
    qc.invalidateQueries({ queryKey: ["vaultPosition"] });
  };

  /**
   * Approve exact amount — NOT max.
   * Shows user exactly what they're approving (safer, less sus).
   */
  async function approveExact(amountWei: bigint): Promise<boolean> {
    setIsApproving(true);
    try {
      await writeContractAsync({
        address:      USDM_ADDRESS,
        abi:          ERC20_ABI,
        functionName: "approve",
        args:         [VAULT_ADDRESS, amountWei],  // EXACT amount, not MAX
      });
      toast.success("APPROVED USDM. NOW DEPOSIT.");
      bust();
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Approval failed";
      toast.error(msg.slice(0, 80));
      return false;
    } finally {
      setIsApproving(false);
    }
  }

  async function deposit(amount: string) {
    const wei = parseUSDMSafe(amount);
    if (wei === 0n) { toast.error("ENTER A VALID AMOUNT"); return; }
    try {
      const hash = await writeContractAsync({
        address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "deposit", args: [wei],
      });
      toast.success("DEPOSITED " + amount + " USDM");
      bust();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message.split("(")[0].slice(0, 80) : "Deposit failed");
    }
  }

  async function withdraw(amount: string) {
    const wei = parseUSDMSafe(amount);
    if (wei === 0n) { toast.error("ENTER A VALID AMOUNT"); return; }
    try {
      await writeContractAsync({
        address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "withdraw", args: [wei],
      });
      toast.success("WITHDRAWN " + amount + " USDM");
      bust();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message.split("(")[0].slice(0, 80) : "Withdraw failed");
    }
  }

  async function buyVia(side: "YES" | "NO", market: Address, amount: string) {
    const wei = parseUSDMSafe(amount);
    if (wei === 0n) { toast.error("ENTER A VALID AMOUNT"); return; }
    try {
      await writeContractAsync({
        address: VAULT_ADDRESS, abi: VAULT_ABI,
        functionName: side === "YES" ? "buyYes" : "buyNo",
        args: [market, wei],
      });
      toast.success("BUYING " + side);
      bust();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message.split("(")[0].slice(0, 80) : "Trade failed");
    }
  }

  async function claimWinnings(market: Address) {
    try {
      await writeContractAsync({
        address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "claimWinnings", args: [market],
      });
      toast.success("WINNINGS CLAIMED!");
      bust();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message.split("(")[0].slice(0, 80) : "Claim failed");
    }
  }

  return { approveExact, deposit, withdraw, buyVia, claimWinnings, isApproving };
}
