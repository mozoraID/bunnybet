"use client";

import { VaultPanel } from "@/components/vault/VaultPanel";
import { useVaultBalance } from "@/hooks/useVault";
import { fmtUSDM }   from "@/lib/utils";
import { VAULT_ADDRESS } from "@/lib/contracts";
import Link from "next/link";

export default function VaultPage() {
  const { data } = useVaultBalance();
  const vaultBal = data?.vaultBalance ?? 0n;

  const isDeployed = VAULT_ADDRESS !== "0x0000000000000000000000000000000000000000";

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 pb-24 md:pb-10">
      {/* Header */}
      <div className="mb-8 border-b border-border-dark pb-8">
        <h1 className="font-sans font-black text-off-white uppercase mb-2"
          style={{ fontSize: "clamp(1.8rem, 4vw, 3rem)", lineHeight: "0.95", letterSpacing: "-0.02em" }}>
          VAULT
        </h1>
        <p className="font-mono text-xs text-dim-2 max-w-sm">
          DEPOSIT USDM ONCE. TRADE ANY MARKET WITHOUT RE-APPROVING.
          WITHDRAW ANYTIME.
        </p>
      </div>

      {!isDeployed ? (
        <div className="terminal-box p-8 text-center">
          <p className="font-mono text-xs text-dim-2 tracking-widest mb-2">VAULT CONTRACT</p>
          <p className="font-mono text-xs text-dim-2 mb-4">NOT YET DEPLOYED</p>
          <p className="font-mono text-[10px] text-dim-2/60">
            Deploy BunnyBetVault.sol and set NEXT_PUBLIC_VAULT_ADDRESS
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <VaultPanel />

          {/* How it works — MegaETH terminal style */}
          <div className="terminal-box p-5 space-y-4 font-mono text-xs">
            <div className="text-[10px] text-dim-2 tracking-widest">ARCHITECTURE</div>
            <div className="space-y-2 text-dim-2">
              <div className="flex gap-3">
                <span className="text-off-white font-bold w-6">01</span>
                <span>APPROVE USDM → VAULT (ONE-TIME, PERMANENT)</span>
              </div>
              <div className="flex gap-3">
                <span className="text-off-white font-bold w-6">02</span>
                <span>DEPOSIT USDM INTO VAULT BALANCE</span>
              </div>
              <div className="flex gap-3">
                <span className="text-off-white font-bold w-6">03</span>
                <span>VAULT AUTO-APPROVES EACH MARKET AS NEEDED</span>
              </div>
              <div className="flex gap-3">
                <span className="text-off-white font-bold w-6">04</span>
                <span>TRADE WITH SINGLE CLICK — NO PER-MARKET APPROVALS</span>
              </div>
              <div className="flex gap-3">
                <span className="text-off-white font-bold w-6">05</span>
                <span>CLAIM WINNINGS BACK TO VAULT BALANCE</span>
              </div>
              <div className="flex gap-3">
                <span className="text-off-white font-bold w-6">06</span>
                <span>WITHDRAW TO WALLET ANYTIME</span>
              </div>
            </div>
          </div>

          {vaultBal > 0n && (
            <div className="border border-off-white/15 p-4 flex items-center justify-between">
              <span className="font-mono text-xs text-dim-2">READY TO TRADE</span>
              <Link href="/" className="font-mono text-xs text-off-white font-bold tracking-widest hover:underline">
                BROWSE MARKETS →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
