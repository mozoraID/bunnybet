"use client";

import { useState, useMemo }    from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ConnectButton }        from "@rainbow-me/rainbowkit";
import toast                    from "react-hot-toast";
import { formatUnits }          from "viem";
import { type Market, type UserPosition } from "@/types/market";
import { MARKET_ABI, MIN_BET_USDM, USDM_DECIMALS, VAULT_ADDRESS, txUrl } from "@/lib/contracts";
import { fmtUSDM, fmtProb, estimatePayout, calcFees, parseUSDMSafe, cn } from "@/lib/utils";
import { useUSDM }     from "@/hooks/useUSDM";
import { useVaultBalance, useVaultActions } from "@/hooks/useVault";
import { ProbabilityBar } from "./ProbabilityBar";

type Side    = "YES" | "NO";
type Mode    = "vault" | "direct";
const PRESETS = ["10", "50", "100", "500"];

export function BuySharesPanel({ market, position, onSuccess }: {
  market: Market; position: UserPosition | null; onSuccess?: () => void;
}) {
  const { address: userAddress, isConnected } = useAccount();
  const [side,       setSide]       = useState<Side>("YES");
  const [rawInput,   setRawInput]   = useState("");
  const [mode,       setMode]       = useState<Mode>("vault");
  const [isApproving, setApproving] = useState(false);

  const betWei = parseUSDMSafe(rawInput);
  const platformFeeBps = market.platformFeeBps ?? 200;

  // Direct mode (legacy ERC20 approve per market)
  const { balance: walletBal, allowance, approve } = useUSDM(market.address);

  // Vault mode
  const { data: vaultData } = useVaultBalance();
  const { buyVia, claimWinnings }  = useVaultActions();
  const vaultBalance = vaultData?.vaultBalance ?? 0n;
  const hasVault     = VAULT_ADDRESS !== "0x0000000000000000000000000000000000000000";

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash });
  const isProcessing = isPending || isConfirming || isApproving;

  const fees    = useMemo(() => betWei > 0n ? calcFees(betWei, platformFeeBps) : null, [betWei, platformFeeBps]);
  const estimate = useMemo(() => betWei === 0n ? null : estimatePayout(
    betWei, platformFeeBps,
    side === "YES" ? market.yesPool : market.noPool,
    side === "YES" ? market.noPool  : market.yesPool,
  ), [betWei, side, platformFeeBps, market.yesPool, market.noPool]);

  const isOpen = !market.resolved && !market.cancelled && market.timeLeft > 0 && !market.paused;
  const activeBalance = mode === "vault" ? vaultBalance : walletBal;
  const insufficientBal = isConnected && betWei > activeBalance;
  const needsApproval   = mode === "direct" && isConnected && betWei > 0n && allowance < betWei;

  async function handleApprove() {
    setApproving(true);
    try { await approve(market.address, betWei); }
    finally { setApproving(false); }
  }

  async function handleBuy() {
    if (!isConnected || betWei === 0n || !isOpen) return;
    if (betWei < parseUSDMSafe(String(MIN_BET_USDM))) { toast.error("MIN BET: 1 USDM"); return; }
    if (insufficientBal) { toast.error("INSUFFICIENT BALANCE"); return; }

    if (mode === "vault" && hasVault) {
      await buyVia(side, market.address, rawInput);
      setRawInput("");
      onSuccess?.();
    } else {
      writeContract(
        { address: market.address, abi: MARKET_ABI, functionName: side === "YES" ? "buyYes" : "buyNo", args: [betWei] },
        {
          onSuccess: (hash) => {
            toast.success(<span>BUYING {side} <a href={txUrl(hash)} target="_blank" rel="noreferrer" className="underline">VIEW TX</a></span>);
            setRawInput(""); onSuccess?.();
          },
          onError: (e) => toast.error(e.message.split("(")[0].slice(0, 80)),
        }
      );
    }
  }

  function doWrite(fn: "redeem" | "claimRefund") {
    writeContract(
      { address: market.address, abi: MARKET_ABI, functionName: fn },
      { onSuccess: () => { toast.success("DONE"); onSuccess?.(); }, onError: (e) => toast.error(e.message.slice(0, 80)) }
    );
  }

  // ── Resolved ────────────────────────────────────────────────────
  if (market.resolved && position) {
    const won = (market.outcome && position.yesShares > 0n) || (!market.outcome && position.noShares > 0n);
    return (
      <div className="card-dark p-5 space-y-4">
        <div className="font-mono text-xs tracking-widest text-dim-2">MARKET RESOLVED</div>
        <div className={cn("p-4 text-center border font-mono",
          market.outcome ? "border-off-white/20 text-off-white" : "border-border-dark text-dim-2")}>
          <div className="text-2xl font-black tracking-tight">
            {market.outcome ? "YES" : "NO"} WINS
          </div>
        </div>
        {won && !position.hasRedeemed && (
          <div className="space-y-2">
            <div className="font-mono text-xs text-dim-2">
              PAYOUT: <span className="text-off-white font-bold">
                {fmtUSDM(market.outcome ? position.estimatedYesPayout : position.estimatedNoPayout)}
              </span>
            </div>
            <button onClick={() => doWrite("redeem")} disabled={isProcessing}
              className="w-full py-3 font-mono text-xs tracking-widest font-bold bg-off-white text-ink hover:bg-cream-2 disabled:opacity-50 transition-all">
              {isProcessing ? "PROCESSING..." : "CLAIM WINNINGS"}
            </button>
          </div>
        )}
        {position.hasRedeemed && <p className="text-center text-xs font-mono text-dim-2">✓ CLAIMED</p>}
        {!won && <p className="text-center text-xs font-mono text-dim-2">LOSING SIDE</p>}
      </div>
    );
  }

  if (market.cancelled) {
    const has = position && (position.yesShares > 0n || position.noShares > 0n);
    return (
      <div className="card-dark p-5 space-y-4">
        <div className="font-mono text-xs text-dim-2">MARKET CANCELLED</div>
        {has && !position?.hasClaimedRefund && (
          <button onClick={() => doWrite("claimRefund")} disabled={isProcessing}
            className="w-full py-3 font-mono text-xs tracking-widest border border-border-dark text-off-white hover:bg-white/5 disabled:opacity-50">
            {isProcessing ? "..." : "CLAIM REFUND"}
          </button>
        )}
        {position?.hasClaimedRefund && <p className="font-mono text-xs text-dim-2 text-center">✓ REFUNDED</p>}
      </div>
    );
  }

  // ── Main panel ─────────────────────────────────────────────────
  return (
    <div className="card-dark overflow-hidden">
      {/* Prob header */}
      <div className="p-4 border-b border-border-dark">
        <ProbabilityBar yesProb={market.yesProb} noProb={market.noProb} size="lg" dark />
      </div>

      <div className="p-5 space-y-4">
        {/* Mode toggle (vault vs direct) */}
        {hasVault && (
          <div className="flex items-center gap-2">
            <div className="grid grid-cols-2 gap-1 p-0.5 bg-ink-4 border border-border-dark flex-1 text-xs font-mono">
              {(["vault", "direct"] as Mode[]).map((m) => (
                <button key={m} onClick={() => setMode(m)}
                  className={cn("py-1.5 tracking-widest transition-all",
                    mode === m ? "bg-off-white text-ink font-bold" : "text-dim-2 hover:text-off-white")}>
                  {m === "vault" ? "VAULT (NO APPROVE)" : "DIRECT"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Balance display */}
        {isConnected && (
          <div className="font-mono text-xs flex items-center justify-between text-dim-2">
            <span>{mode === "vault" ? "VAULT BALANCE" : "WALLET BALANCE"}</span>
            <span className="text-off-white">{fmtUSDM(activeBalance)}</span>
          </div>
        )}

        {/* YES / NO */}
        <div className="grid grid-cols-2 gap-1 p-0.5 bg-ink-4 border border-border-dark">
          {(["YES", "NO"] as Side[]).map((s) => (
            <button key={s} onClick={() => setSide(s)}
              className={cn("py-2.5 font-mono text-sm tracking-widest font-bold transition-all",
                side === s
                  ? "bg-off-white text-ink"
                  : "text-dim-2 hover:text-off-white")}>
              {s} {fmtProb(s === "YES" ? market.yesProb : market.noProb)}
            </button>
          ))}
        </div>

        {/* Amount input */}
        <div>
          <div className="relative border border-border-dark bg-ink-4">
            <input type="number" placeholder="0" value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              className="w-full bg-transparent px-4 py-3 text-xl font-mono text-off-white placeholder-dim-2 pr-24 focus:border-off-white/30 transition-colors"
              min={MIN_BET_USDM} step="1"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <span className="font-mono text-xs text-dim-2 font-bold">USDM</span>
              {isConnected && activeBalance > 0n && (
                <button onClick={() => setRawInput(formatUnits(activeBalance, USDM_DECIMALS))}
                  className="font-mono text-[10px] text-dim-2 hover:text-off-white tracking-widest">
                  MAX
                </button>
              )}
            </div>
          </div>
          <div className="flex gap-1 mt-1">
            {PRESETS.map((p) => (
              <button key={p} onClick={() => setRawInput(p)}
                className={cn("flex-1 py-1.5 font-mono text-xs border transition-all",
                  rawInput === p
                    ? "border-off-white/40 text-off-white bg-off-white/8"
                    : "border-border-dark text-dim-2 hover:text-off-white")}>
                ${p}
              </button>
            ))}
          </div>
        </div>

        {/* Fee breakdown */}
        {fees && betWei > 0n && (
          <div className="border border-border-dark p-3 space-y-1.5 font-mono text-xs">
            <Row label={`PLATFORM FEE (${platformFeeBps / 100}%)`} value={fmtUSDM(fees.platformFee)} />
            <Row label="CREATOR FEE (1%)"                          value={fmtUSDM(fees.creatorFee)} />
            <div className="border-t border-border-dark my-1" />
            <Row label="YOUR SHARES" value={fmtUSDM(fees.net)} bright />
            {estimate && <>
              <Row label={`EST. PAYOUT IF ${side}`} value={fmtUSDM(estimate.payout)} bright />
              <Row label="MULTIPLIER" value={`${estimate.multiplier.toFixed(2)}×`} />
            </>}
          </div>
        )}

        {/* Vault deposit hint */}
        {mode === "vault" && vaultBalance === 0n && hasVault && (
          <div className="border border-off-white/10 p-3 font-mono text-xs text-dim-2">
            YOUR VAULT BALANCE IS 0.{" "}
            <Link href="/vault" className="text-off-white underline">DEPOSIT USDM →</Link>
          </div>
        )}

        {/* CTA */}
        {!isConnected ? (
          <div className="flex justify-center"><ConnectButton /></div>
        ) : mode === "direct" && needsApproval ? (
          <button onClick={handleApprove} disabled={isProcessing || betWei === 0n}
            className="w-full py-3.5 font-mono text-xs tracking-widest font-bold bg-off-white/15 text-off-white border border-off-white/20 hover:bg-off-white/20 disabled:opacity-50">
            {isApproving ? "APPROVING..." : "STEP 1: APPROVE USDM"}
          </button>
        ) : (
          <button onClick={handleBuy}
            disabled={!isOpen || isProcessing || betWei === 0n || insufficientBal}
            className={cn(
              "w-full py-3.5 font-mono text-xs tracking-widest font-bold transition-all",
              isOpen && betWei > 0n && !insufficientBal
                ? "bg-off-white text-ink hover:bg-cream"
                : "bg-ink-4 text-dim-2 cursor-not-allowed border border-border-dark"
            )}>
            {isProcessing ? "PROCESSING..."
              : insufficientBal ? "INSUFFICIENT BALANCE"
              : `BUY ${side}${betWei > 0n ? ` · $${rawInput}` : ""}`}
          </button>
        )}

        <div className="border-t border-border-dark pt-3 flex items-center justify-between font-mono text-xs text-dim-2">
          <span>TOTAL POOL</span>
          <span className="text-off-white">{fmtUSDM(market.totalPool)}</span>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bright }: { label: string; value: string; bright?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-dim-2">{label}</span>
      <span className={bright ? "text-off-white font-bold" : "text-dim-2"}>{value}</span>
    </div>
  );
}

import Link from "next/link";
