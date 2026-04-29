"use client";

import { useState }      from "react";
import { useAccount }    from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { formatUnits }   from "viem";
import { useVaultBalance, useVaultActions } from "@/hooks/useVault";
import { fmtUSDM, parseUSDMSafe, cn }  from "@/lib/utils";
import { USDM_DECIMALS } from "@/lib/contracts";

type Tab = "deposit" | "withdraw";
const PRESETS = ["10", "50", "100", "500"];

export function VaultPanel() {
  const { isConnected } = useAccount();
  const [tab,    setTab]    = useState<Tab>("deposit");
  const [amount, setAmount] = useState("");
  const [busy,   setBusy]   = useState(false);

  const { data: bal }                                          = useVaultBalance();
  const { approveExact, deposit, withdraw, isApproving }  = useVaultActions();

  const vaultBal  = bal?.vaultBalance  ?? 0n;
  const walletBal = bal?.walletBalance ?? 0n;
  const allowance = bal?.allowance     ?? 0n;

  const amountWei = parseUSDMSafe(amount);
  // Need approval if depositing and allowance < amount
  const needsApproval = tab === "deposit" && amountWei > 0n && allowance < amountWei;

  async function handle() {
    setBusy(true);
    try {
      if (needsApproval) {
        // Approve EXACT amount the user wants to deposit
        const ok = await approveExact(amountWei);
        if (!ok) return;
        // Auto-deposit after approval
        await deposit(amount);
        setAmount("");
      } else if (tab === "deposit") {
        await deposit(amount);
        setAmount("");
      } else {
        await withdraw(amount);
        setAmount("");
      }
    } finally { setBusy(false); }
  }

  if (!isConnected) return (
    <div className="card-dark p-8 text-center space-y-4">
      <p className="font-mono text-xs text-dim-2 tracking-widest">CONNECT WALLET TO USE VAULT</p>
      <ConnectButton />
    </div>
  );

  return (
    <div className="card-dark overflow-hidden">
      {/* Balance terminal */}
      <div className="terminal-box p-5 border-b border-border-dark">
        <div className="font-mono text-[10px] text-dim-2 tracking-widest mb-3">VAULT BALANCE</div>
        <div className="text-3xl font-mono font-bold text-off-white">{fmtUSDM(vaultBal)}</div>
        <div className="flex items-center justify-between mt-2">
          <span className="font-mono text-[10px] text-dim-2">WALLET: {fmtUSDM(walletBal)}</span>
          {vaultBal > 0n && <span className="font-mono text-[10px] text-dim-2">✓ TRADE WITHOUT APPROVALS</span>}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* How it works */}
        <div className="border border-border-dark p-3 font-mono text-xs text-dim-2 space-y-1">
          <p className="text-off-white font-bold">HOW VAULT WORKS</p>
          <p>1. Deposit USDM into vault (approval for exact amount)</p>
          <p>2. Trade any market with one click — no more approvals</p>
          <p>3. Withdraw anytime</p>
        </div>

        {/* Tab */}
        <div className="grid grid-cols-2 gap-1 p-0.5 bg-ink-4 border border-border-dark">
          {(["deposit", "withdraw"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={cn("py-2 font-mono text-xs tracking-widest font-bold transition-all",
                tab === t ? "bg-off-white text-ink" : "text-dim-2 hover:text-off-white")}>
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Balance hint */}
        <div className="flex justify-between font-mono text-xs text-dim-2">
          <span>{tab === "deposit" ? "WALLET" : "VAULT"}:</span>
          <span className="text-off-white">{fmtUSDM(tab === "deposit" ? walletBal : vaultBal)}</span>
        </div>

        {/* Input */}
        <div>
          <div className="relative border border-border-dark bg-ink-4">
            <input type="number" placeholder="0" value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-transparent px-4 py-3 text-xl font-mono text-off-white placeholder-dim-2 pr-24"
              min="1" step="1"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <span className="font-mono text-xs text-dim-2 font-bold">USDM</span>
              <button onClick={() => {
                const max = tab === "deposit" ? walletBal : vaultBal;
                setAmount(formatUnits(max, USDM_DECIMALS));
              }} className="font-mono text-[10px] text-dim-2 hover:text-off-white tracking-widest">
                MAX
              </button>
            </div>
          </div>
          <div className="flex gap-1 mt-1">
            {PRESETS.map((p) => (
              <button key={p} onClick={() => setAmount(p)}
                className={cn("flex-1 py-1.5 font-mono text-xs border transition-all",
                  amount === p ? "border-off-white/40 text-off-white" : "border-border-dark text-dim-2 hover:text-off-white")}>
                ${p}
              </button>
            ))}
          </div>
        </div>

        {/* Approval notice — only show when needed, with exact amount */}
        {needsApproval && amountWei > 0n && (
          <div className="border border-off-white/10 p-3 font-mono text-xs text-dim-2">
            WILL APPROVE EXACTLY <span className="text-off-white font-bold">{amount} USDM</span> → VAULT,
            THEN DEPOSIT AUTOMATICALLY.
          </div>
        )}

        {/* CTA */}
        <button onClick={handle} disabled={busy || isApproving || !amount || Number(amount) <= 0}
          className={cn("w-full py-3.5 font-mono text-xs tracking-widest font-bold transition-all",
            !busy && !isApproving && amount && Number(amount) > 0
              ? "bg-off-white text-ink hover:bg-cream"
              : "bg-ink-4 text-dim-2 cursor-not-allowed border border-border-dark")}>
          {(busy || isApproving)
            ? "PROCESSING..."
            : needsApproval
              ? `APPROVE & DEPOSIT ${amount} USDM`
              : tab === "deposit"
                ? `DEPOSIT ${amount || "0"} USDM`
                : `WITHDRAW ${amount || "0"} USDM`}
        </button>
      </div>
    </div>
  );
}
