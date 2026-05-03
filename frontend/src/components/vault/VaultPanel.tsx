"use client";

import { useState }      from "react";
import { useAccount }    from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { formatUnits }   from "viem";
import { AlertTriangle, Info, CheckCircle, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { useVaultBalance, useVaultActions } from "@/hooks/useVault";
import { RelayDepositWidget  } from "./RelayDepositWidget";
import { RelayWithdrawWidget } from "./RelayWithdrawWidget";
import { fmtUSDM, parseUSDMSafe, cn } from "@/lib/utils";
import { USDM_DECIMALS } from "@/lib/contracts";

type Tab = "multi-chain" | "direct" | "withdraw";

const MIN_DIRECT_DEPOSIT = 3;
const PRESETS = ["10", "50", "100", "500"];

export function VaultPanel() {
  const { address, isConnected } = useAccount();
  const [tab,    setTab]    = useState<Tab>("multi-chain");
  const [amount, setAmount] = useState("");
  const [busy,   setBusy]   = useState(false);

  const { data: bal }                                   = useVaultBalance();
  const { approveExact, deposit, withdraw, isApproving } = useVaultActions();

  const vaultBal  = bal?.vaultBalance  ?? 0n;
  const walletBal = bal?.walletBalance ?? 0n;
  const allowance = bal?.allowance     ?? 0n;

  const amtNum    = parseFloat(amount) || 0;
  const amtWei    = parseUSDMSafe(amount);
  const needsApproval = tab === "direct" && amtWei > 0n && allowance < amtWei;

  // Validation
  const errors: string[] = [];
  if (amount && amtNum > 0) {
    if (tab === "direct" && amtNum < MIN_DIRECT_DEPOSIT)
      errors.push(`MINIMUM DEPOSIT IS ${MIN_DIRECT_DEPOSIT} USDM`);
    if (tab === "direct" && amtWei > walletBal)
      errors.push(`INSUFFICIENT WALLET BALANCE (${fmtUSDM(walletBal)} AVAILABLE)`);
  }

  const canSubmit = tab === "direct" && errors.length === 0 && amtNum >= MIN_DIRECT_DEPOSIT && !busy && !isApproving;

  async function handleDirect() {
    if (!canSubmit) return;
    setBusy(true);
    try {
      if (needsApproval) { await approveExact(amtWei); }
      await deposit(amount); setAmount("");
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
      {/* Balance header */}
      <div className="terminal-box p-5 border-b border-border-dark">
        <div className="font-mono text-[10px] text-dim-2 tracking-widest mb-2">VAULT BALANCE</div>
        <div className="text-3xl font-mono font-bold text-off-white">{fmtUSDM(vaultBal)}</div>
        <div className="flex justify-between mt-1.5">
          <span className="font-mono text-[10px] text-dim-2">
            WALLET USDM: <span className="text-off-white">{fmtUSDM(walletBal)}</span>
          </span>
          {vaultBal > 0n && (
            <span className="font-mono text-[10px] text-dim-2 flex items-center gap-1">
              <CheckCircle size={9} className="text-green-400/60" /> READY TO TRADE
            </span>
          )}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Mode tabs */}
        <div className="grid grid-cols-3 gap-1 p-0.5 bg-ink-4 border border-border-dark">
          {([
            { id: "multi-chain", label: "MULTI-CHAIN", icon: <ArrowDownToLine size={11} /> },
            { id: "direct",      label: "USDM DIRECT", icon: <ArrowDownToLine size={11} /> },
            { id: "withdraw",    label: "WITHDRAW",     icon: <ArrowUpFromLine size={11} /> },
          ] as { id: Tab; label: string; icon: React.ReactNode }[]).map(({ id, label, icon }) => (
            <button key={id} onClick={() => { setTab(id); setAmount(""); }}
              className={cn(
                "py-2 font-mono text-[10px] tracking-wider font-bold transition-all flex items-center justify-center gap-1",
                tab === id ? "bg-off-white text-ink" : "text-dim-2 hover:text-off-white"
              )}>
              {icon} {label}
            </button>
          ))}
        </div>

        {/* ── MULTI-CHAIN DEPOSIT (via Relay) ──────────────────── */}
        {tab === "multi-chain" && (
          <RelayDepositWidget
            userAddress={address!}
            onSuccess={() => setTab("direct")}
          />
        )}

        {/* ── DIRECT USDM DEPOSIT ──────────────────────────────── */}
        {tab === "direct" && (
          <>
            <div className="border border-off-white/8 p-3 font-mono text-xs text-dim-2 flex gap-2">
              <Info size={11} className="shrink-0 mt-0.5 text-off-white/30" />
              DEPOSIT USDM DIRECTLY FROM MEGAETH WALLET.
              TRADE ANY MARKET WITHOUT PER-MARKET APPROVALS.
              MIN {MIN_DIRECT_DEPOSIT} USDM.
            </div>

            <div className="flex justify-between font-mono text-xs text-dim-2">
              <span>WALLET BALANCE</span>
              <span className={walletBal > 0n ? "text-off-white" : "text-red-400/70"}>
                {fmtUSDM(walletBal)}
              </span>
            </div>

            <div>
              <div className="flex justify-between mb-1 font-mono text-[10px] text-dim-2">
                <span>AMOUNT (MIN {MIN_DIRECT_DEPOSIT} USDM)</span>
              </div>
              <div className={cn(
                "relative border bg-ink-4 transition-colors",
                errors.length > 0 && amount ? "border-red-400/40" : "border-border-dark focus-within:border-off-white/30"
              )}>
                <input type="number" placeholder="0" value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-transparent px-4 py-3 text-xl font-mono text-off-white placeholder-dim-2 pr-28"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <span className="font-mono text-xs text-dim-2">USDM</span>
                  <button onClick={() => setAmount(formatUnits(walletBal, USDM_DECIMALS))}
                    className="font-mono text-[10px] text-dim-2 hover:text-off-white border border-border-dark px-1.5 py-0.5">
                    MAX
                  </button>
                </div>
              </div>
              <div className="flex gap-1 mt-1">
                {PRESETS.map((p) => (
                  <button key={p} onClick={() => setAmount(p)}
                    className={cn(
                      "flex-1 py-1.5 font-mono text-xs border transition-all",
                      amount === p ? "border-off-white/40 text-off-white" : "border-border-dark text-dim-2 hover:text-off-white"
                    )}>
                    ${p}
                  </button>
                ))}
              </div>
            </div>

            {errors.map((e, i) => (
              <div key={i} className="border border-red-400/30 bg-red-400/5 p-3 font-mono text-xs text-red-400/90 flex gap-2">
                <AlertTriangle size={11} className="shrink-0 mt-0.5" /> {e}
              </div>
            ))}

            {needsApproval && amtNum >= MIN_DIRECT_DEPOSIT && (
              <div className="border border-off-white/10 p-3 font-mono text-xs text-dim-2">
                <span className="text-off-white font-bold">2-STEP:</span>
                {" "}APPROVE EXACTLY <span className="text-off-white">{amount} USDM</span> → DEPOSIT
              </div>
            )}

            <button onClick={handleDirect} disabled={!canSubmit}
              className={cn(
                "w-full py-3.5 font-mono text-xs tracking-widest font-bold transition-all",
                canSubmit ? "bg-off-white text-ink hover:bg-cream" : "bg-ink-4 text-dim-2 cursor-not-allowed border border-border-dark"
              )}>
              {(busy || isApproving) ? "PROCESSING..."
                : !amount || amtNum === 0 ? "ENTER AMOUNT"
                : errors.length > 0 ? errors[0]
                : needsApproval ? `APPROVE & DEPOSIT ${amount} USDM`
                : `DEPOSIT ${amount} USDM`}
            </button>
          </>
        )}

        {/* ── WITHDRAW via Relay ───────────────────────────────── */}
        {tab === "withdraw" && (
          <RelayWithdrawWidget
            userAddress={address!}
            vaultBalance={vaultBal}
            onSuccess={() => {}}
          />
        )}

        {/* Fee info */}
        <div className="border-t border-border-dark pt-3 font-mono text-[10px] text-dim-2 space-y-0.5">
          <p>• NO FEE TO DEPOSIT VIA USDM DIRECT</p>
          <p>• RELAY BRIDGE: ~0.05-0.2% NETWORK FEE + 0.01% BUNNYBET FEE</p>
          <p>• TRADING FEE: 3% PER MARKET (2% PLATFORM + 1% CREATOR)</p>
          <p>• VAULT CONTRACT:{" "}
            <a href="https://megaeth.blockscout.com/address/0x8B0A2A82486E3A3CC603E428F325AeDC1f71E1a0"
              target="_blank" rel="noreferrer" className="text-off-white/50 hover:text-off-white underline">
              0x8B0A...1a0
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
