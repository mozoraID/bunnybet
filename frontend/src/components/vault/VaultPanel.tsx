"use client";

import { useState }      from "react";
import { useAccount }    from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { formatUnits }   from "viem";
import { AlertTriangle, Info, CheckCircle, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { useVaultBalance, useVaultActions } from "@/hooks/useVault";
import { fmtUSDM, parseUSDMSafe, cn }  from "@/lib/utils";
import { USDM_DECIMALS } from "@/lib/contracts";

type Tab = "deposit" | "withdraw";

const MIN_DEPOSIT  = 3;   // minimum 3 USDM
const MIN_WITHDRAW = 1;
const PRESETS = ["10", "50", "100", "500"];

export function VaultPanel() {
  const { isConnected } = useAccount();
  const [tab,    setTab]    = useState<Tab>("deposit");
  const [amount, setAmount] = useState("");
  const [busy,   setBusy]   = useState(false);

  const { data: bal }                               = useVaultBalance();
  const { approveExact, deposit, withdraw, isApproving } = useVaultActions();

  const vaultBal  = bal?.vaultBalance  ?? 0n;
  const walletBal = bal?.walletBalance ?? 0n;
  const allowance = bal?.allowance     ?? 0n;

  const amountNum = parseFloat(amount) || 0;
  const amountWei = parseUSDMSafe(amount);
  const minAmt    = tab === "deposit" ? MIN_DEPOSIT : MIN_WITHDRAW;
  const maxAmt    = tab === "deposit" ? walletBal   : vaultBal;

  // ── Validation ──────────────────────────────────────────────────
  const errors: string[] = [];
  const warnings: string[] = [];
  const infos: string[] = [];

  if (amount && amountNum > 0) {
    if (tab === "deposit") {
      if (amountNum < MIN_DEPOSIT)
        errors.push(`MINIMUM DEPOSIT IS ${MIN_DEPOSIT} USDM`);
      if (amountWei > walletBal)
        errors.push(`INSUFFICIENT WALLET BALANCE (${fmtUSDM(walletBal)} AVAILABLE)`);
      if (walletBal === 0n)
        warnings.push("YOUR WALLET HAS 0 USDM. GET USDM ON MEGAETH FIRST.");
    } else {
      if (amountNum < MIN_WITHDRAW)
        errors.push(`MINIMUM WITHDRAW IS ${MIN_WITHDRAW} USDM`);
      if (amountWei > vaultBal)
        errors.push(`INSUFFICIENT VAULT BALANCE (${fmtUSDM(vaultBal)} AVAILABLE)`);
      if (vaultBal === 0n)
        warnings.push("YOUR VAULT IS EMPTY. DEPOSIT FIRST.");
    }
  }

  if (tab === "deposit" && walletBal > 0n && vaultBal === 0n)
    infos.push("FIRST DEPOSIT: YOU'LL APPROVE EXACT AMOUNT, THEN DEPOSIT IN 2 TRANSACTIONS.");

  if (vaultBal > 0n)
    infos.push(`VAULT BALANCE OF ${fmtUSDM(vaultBal)} READY — TRADE ANY MARKET WITHOUT APPROVALS.`);

  const needsApproval = tab === "deposit" && amountWei > 0n && allowance < amountWei;
  const canSubmit = errors.length === 0 && amountNum >= minAmt && amountWei <= maxAmt && !busy && !isApproving;

  async function handle() {
    if (!canSubmit) return;
    setBusy(true);
    try {
      if (tab === "deposit") {
        if (needsApproval) {
          const ok = await approveExact(amountWei);
          if (!ok) return;
        }
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
      {/* Balance */}
      <div className="terminal-box p-5 border-b border-border-dark">
        <div className="font-mono text-[10px] text-dim-2 tracking-widest mb-2">VAULT BALANCE</div>
        <div className="text-3xl font-mono font-bold text-off-white">{fmtUSDM(vaultBal)}</div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="font-mono text-[10px] text-dim-2">
            WALLET: <span className={walletBal > 0n ? "text-off-white" : "text-red-400/70"}>{fmtUSDM(walletBal)}</span>
          </span>
          {vaultBal > 0n && (
            <span className="font-mono text-[10px] text-dim-2 flex items-center gap-1">
              <CheckCircle size={10} className="text-green-400/60" />
              READY TO TRADE
            </span>
          )}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Guide */}
        <div className="border border-border-dark p-3 font-mono text-xs space-y-1.5">
          <div className="text-off-white font-bold flex items-center gap-1.5">
            <Info size={11} /> HOW VAULT WORKS
          </div>
          <div className="text-dim-2 space-y-1">
            <p>① DEPOSIT USDM INTO VAULT <span className="text-off-white">(MIN {MIN_DEPOSIT} USDM)</span></p>
            <p>② TRADE ANY MARKET WITH 1 CLICK — NO PER-MARKET APPROVALS</p>
            <p>③ WINNINGS GO BACK TO VAULT BALANCE AUTOMATICALLY</p>
            <p>④ WITHDRAW TO WALLET ANYTIME, NO LOCKUP</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 gap-1 p-0.5 bg-ink-4 border border-border-dark">
          {(["deposit", "withdraw"] as Tab[]).map((t) => (
            <button key={t} onClick={() => { setTab(t); setAmount(""); }}
              className={cn("py-2 font-mono text-xs tracking-widest font-bold transition-all flex items-center justify-center gap-1.5",
                tab === t ? "bg-off-white text-ink" : "text-dim-2 hover:text-off-white")}>
              {t === "deposit" ? <ArrowDownToLine size={12} /> : <ArrowUpFromLine size={12} />}
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Balance row */}
        <div className="flex justify-between font-mono text-xs">
          <span className="text-dim-2">{tab === "deposit" ? "WALLET BALANCE" : "VAULT BALANCE"}</span>
          <span className={cn(maxAmt > 0n ? "text-off-white" : "text-red-400/70")}>
            {fmtUSDM(tab === "deposit" ? walletBal : vaultBal)}
          </span>
        </div>

        {/* Amount input */}
        <div>
          <div className="flex items-center justify-between mb-1 font-mono text-[10px] text-dim-2">
            <span>AMOUNT (MIN {minAmt} USDM)</span>
            {amountNum > 0 && amountNum < minAmt && (
              <span className="text-red-400/80">MIN {minAmt} USDM</span>
            )}
          </div>
          <div className={cn("relative border bg-ink-4 transition-colors",
            errors.length > 0 && amount ? "border-red-400/40" : "border-border-dark focus-within:border-off-white/30")}>
            <input type="number" placeholder="0" value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-transparent px-4 py-3 text-xl font-mono text-off-white placeholder-dim-2 pr-28"
              min={minAmt} step="1"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <span className="font-mono text-xs text-dim-2 font-bold">USDM</span>
              <button onClick={() => setAmount(formatUnits(maxAmt, USDM_DECIMALS))}
                className="font-mono text-[10px] text-dim-2 hover:text-off-white tracking-widest border border-border-dark px-1.5 py-0.5">
                MAX
              </button>
            </div>
          </div>

          {/* Quick amounts */}
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

        {/* Error messages */}
        {errors.map((e, i) => (
          <div key={i} className="flex items-start gap-2 border border-red-400/30 bg-red-400/5 p-3 font-mono text-xs text-red-400/90">
            <AlertTriangle size={11} className="shrink-0 mt-0.5" />
            {e}
          </div>
        ))}

        {/* Warning messages */}
        {warnings.map((w, i) => (
          <div key={i} className="flex items-start gap-2 border border-yellow-400/30 bg-yellow-400/5 p-3 font-mono text-xs text-yellow-400/90">
            <AlertTriangle size={11} className="shrink-0 mt-0.5" />
            {w}
          </div>
        ))}

        {/* Info messages */}
        {infos.map((info, i) => (
          <div key={i} className="flex items-start gap-2 border border-off-white/10 p-3 font-mono text-xs text-dim-2">
            <Info size={11} className="shrink-0 mt-0.5 text-off-white/40" />
            {info}
          </div>
        ))}

        {/* Approval notice */}
        {needsApproval && canSubmit && (
          <div className="border border-off-white/10 p-3 font-mono text-xs text-dim-2">
            <span className="text-off-white font-bold">2-STEP PROCESS:</span>
            {" "}STEP 1: APPROVE EXACTLY <span className="text-off-white">{amount} USDM</span> TO VAULT.
            STEP 2: DEPOSIT AUTOMATICALLY.
          </div>
        )}

        {/* CTA Button */}
        <button onClick={handle}
          disabled={!canSubmit}
          className={cn("w-full py-3.5 font-mono text-xs tracking-widest font-bold transition-all",
            canSubmit
              ? tab === "deposit"
                ? "bg-off-white text-ink hover:bg-cream"
                : "bg-ink-3 text-off-white border border-border-dark hover:border-off-white/30"
              : "bg-ink-4 text-dim-2 cursor-not-allowed border border-border-dark")}>
          {(busy || isApproving) ? "PROCESSING..."
            : !amount || amountNum === 0 ? (tab === "deposit" ? "ENTER DEPOSIT AMOUNT" : "ENTER WITHDRAW AMOUNT")
            : errors.length > 0 ? errors[0]
            : needsApproval ? `APPROVE & DEPOSIT ${amount} USDM`
            : tab === "deposit" ? `DEPOSIT ${amount} USDM` : `WITHDRAW ${amount} USDM`}
        </button>

        {/* Fee notice */}
        <div className="border-t border-border-dark pt-3 font-mono text-[10px] text-dim-2 space-y-0.5">
          <p>• NO FEE TO DEPOSIT OR WITHDRAW</p>
          <p>• 3% TRADING FEE PER MARKET (2% PLATFORM + 1% CREATOR)</p>
          <p>• VAULT CONTRACT: <a href={`https://megaeth.blockscout.com/address/0x8B0A2A82486E3A3CC603E428F325AeDC1f71E1a0`}
            target="_blank" rel="noreferrer" className="text-off-white/50 hover:text-off-white underline">0x8B0A...1a0</a></p>
        </div>
      </div>
    </div>
  );
}
