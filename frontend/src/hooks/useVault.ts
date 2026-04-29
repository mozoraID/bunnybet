"use client";

import { useQuery, useQueryClient }  from "@tanstack/react-query";
import {
  usePublicClient, useAccount,
  useWriteContract,
} from "wagmi";
import { useState }       from "react";
import toast              from "react-hot-toast";
import { formatUnits }    from "viem";
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
      const [vaultBal, walletBal, allowance] = await client.multicall({
        contracts: [
          { address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "balance",   args: [address] },
          { address: USDM_ADDRESS,  abi: ERC20_ABI, functionName: "balanceOf", args: [address] },
          { address: USDM_ADDRESS,  abi: ERC20_ABI, functionName: "allowance", args: [address, VAULT_ADDRESS] },
        ] as Parameters<typeof client.multicall>[0]["contracts"],
        allowFailure: false,
      });
      return {
        vaultBalance:  vaultBal  as bigint,
        walletBalance: walletBal as bigint,
        allowance:     allowance as bigint,
      };
    },
    refetchInterval: 3_000,
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
      const r = await client.readContract({
        address:      VAULT_ADDRESS,
        abi:          VAULT_ABI,
        functionName: "getUserPosition",
        args:         [address, marketAddress],
      }) as [bigint, bigint, bigint, boolean];
      return { yesShares: r[0], noShares: r[1], estimatedPayout: r[2], hasClaimed: r[3] };
    },
    refetchInterval: 2_000,
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

  async function approveVault(): Promise<boolean> {
    setIsApproving(true);
    try {
      const hash = await writeContractAsync({
        address:      USDM_ADDRESS,
        abi:          ERC20_ABI,
        functionName: "approve",
        args: [VAULT_ADDRESS, BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")],
      });
      toast.loading("APPROVING USDM...", { id: "vault-approve" });
      await pollReceipt(hash);
      toast.success("USDM APPROVED! NOW YOU CAN DEPOSIT.", { id: "vault-approve" });
      bust();
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Approval failed";
      toast.error(msg.slice(0, 80), { id: "vault-approve" });
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
        address:      VAULT_ADDRESS,
        abi:          VAULT_ABI,
        functionName: "deposit",
        args:         [wei],
      });
      toast.success("DEPOSITED! TX: " + txUrl(hash).slice(0, 40) + "...");
      bust();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message.split("(")[0].slice(0, 80) : "Deposit failed";
      toast.error(msg);
    }
  }

  async function withdraw(amount: string) {
    const wei = parseUSDMSafe(amount);
    if (wei === 0n) { toast.error("ENTER A VALID AMOUNT"); return; }
    try {
      const hash = await writeContractAsync({
        address:      VAULT_ADDRESS,
        abi:          VAULT_ABI,
        functionName: "withdraw",
        args:         [wei],
      });
      toast.success("WITHDRAWN SUCCESSFULLY");
      bust();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message.split("(")[0].slice(0, 80) : "Withdraw failed";
      toast.error(msg);
    }
  }

  async function buyVia(side: "YES" | "NO", market: Address, amount: string) {
    const wei = parseUSDMSafe(amount);
    if (wei === 0n) { toast.error("ENTER A VALID AMOUNT"); return; }
    try {
      const hash = await writeContractAsync({
        address:      VAULT_ADDRESS,
        abi:          VAULT_ABI,
        functionName: side === "YES" ? "buyYes" : "buyNo",
        args:         [market, wei],
      });
      toast.success("BUYING " + side + " — TX SUBMITTED");
      bust();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message.split("(")[0].slice(0, 80) : "Trade failed";
      toast.error(msg);
    }
  }

  async function claimWinnings(market: Address) {
    try {
      await writeContractAsync({
        address:      VAULT_ADDRESS,
        abi:          VAULT_ABI,
        functionName: "claimWinnings",
        args:         [market],
      });
      toast.success("WINNINGS CLAIMED! CHECK VAULT BALANCE.");
      bust();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message.split("(")[0].slice(0, 80) : "Claim failed";
      toast.error(msg);
    }
  }

  return { approveVault, deposit, withdraw, buyVia, claimWinnings, isApproving };
}

async function pollReceipt(hash: `0x${string}`, maxMs = 30_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    await new Promise((r) => setTimeout(r, 1_500));
    try {
      const res = await fetch(`https://megaeth.blockscout.com/api?module=transaction&action=gettxreceiptstatus&txhash=${hash}`);
      const j = await res.json();
      if (j?.result?.status === "1") return;
    } catch {}
  }
}
