"use client";

import { useState, useMemo }    from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ConnectButton }        from "@rainbow-me/rainbowkit";
import toast                    from "react-hot-toast";
import { formatUnits }          from "viem";
import { Zap, ArrowRight, CheckCircle, AlertCircle, ShieldCheck, Info } from "lucide-react";
import { type Market, type UserPosition } from "@/types/market";
import { MARKET_ABI, MIN_BET_USDM, USDM_DECIMALS, txUrl } from "@/lib/contracts";
import { fmtUSDM, fmtProb, estimatePayout, calcFees, parseUSDMSafe, cn } from "@/lib/utils";
import { useUSDM }  from "@/hooks/useUSDM";
import { ProbabilityBar } from "./ProbabilityBar";

type Side = "YES" | "NO";
const PRESETS = ["10", "50", "100", "500"];

interface Props {
  market:   Market;
  position: UserPosition | null;
  onSuccess?: () => void;
}

export function BuySharesPanel({ market, position, onSuccess }: Props) {
  const { address: userAddress, isConnected } = useAccount();
  const [side,       setSide]       = useState<Side>("YES");
  const [rawInput,   setRawInput]   = useState("");
  const [isApproving, setIsApproving] = useState(false);

  const betWei = parseUSDMSafe(rawInput);
  const { balance, allowance, approve } = useUSDM(market.address);

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash });
  const isProcessing = isPending || isConfirming || isApproving;

  // Platform fee from market (immutable per market)
  const platformFeeBps = market.platformFeeBps ?? 200;

  const fees = useMemo(() => betWei > 0n ? calcFees(betWei, platformFeeBps) : null, [betWei, platformFeeBps]);

  const estimate = useMemo(() => {
    if (betWei === 0n) return null;
    return estimatePayout(
      betWei, platformFeeBps,
      side === "YES" ? market.yesPool : market.noPool,
      side === "YES" ? market.noPool  : market.yesPool,
    );
  }, [betWei, side, platformFeeBps, market.yesPool, market.noPool]);

  const isOpen           = !market.resolved && !market.cancelled && market.timeLeft > 0 && !market.paused;
  const needsApproval    = isConnected && betWei > 0n && allowance < betWei;
  const insufficientBal  = isConnected && betWei > balance;

  // ── Approve ───────────────────────────────────────────────────────────────
  async function handleApprove() {
    setIsApproving(true);
    try { await approve(market.address, betWei); }
    finally { setIsApproving(false); }
  }

  // ── Buy ───────────────────────────────────────────────────────────────────
  async function handleBuy() {
    if (!isConnected || betWei === 0n || !isOpen || needsApproval) return;
    if (betWei < parseUSDMSafe(String(MIN_BET_USDM))) {
      toast.error(`Minimum bet is ${MIN_BET_USDM} USDM`);
      return;
    }
    if (insufficientBal) { toast.error("Insufficient USDM balance"); return; }

    writeContract(
      {
        address:      market.address,
        abi:          MARKET_ABI,
        functionName: side === "YES" ? "buyYes" : "buyNo",
        args:         [betWei],
      },
      {
        onSuccess: (hash) => {
          toast.success(
            <span>Buying {side}!{" "}
              <a href={txUrl(hash)} target="_blank" rel="noreferrer" className="underline">View tx</a>
            </span>
          );
          setRawInput("");
          onSuccess?.();
        },
        onError: (err) => toast.error(err.message.split("(")[0].slice(0, 80)),
      }
    );
  }

  // ── Resolved state ────────────────────────────────────────────────────────
  if (market.resolved && position) {
    const won = (market.outcome && position.yesShares > 0n) ||
                (!market.outcome && position.noShares  > 0n);
    return (
      <div className="glass rounded-xl p-5 space-y-4">
        <h3 className="font-semibold text-primary flex items-center gap-2">
          <CheckCircle size={16} className="text-cyan" />Market Resolved
        </h3>
        <div className={cn("rounded-lg p-4 text-center border",
          market.outcome ? "bg-cyan/10 border-cyan/20" : "bg-pink/10 border-pink/20")}>
          <div className="text-2xl font-bold">
            {market.outcome ? <span className="text-cyan">YES</span> : <span className="text-pink">NO</span>} won
          </div>
        </div>
        {won && !position.hasRedeemed && (
          <div className="space-y-2">
            <div className="text-sm text-secondary">
              Your payout:{" "}
              <span className="text-cyan font-mono font-bold">
                {fmtUSDM(market.outcome ? position.estimatedYesPayout : position.estimatedNoPayout)}
              </span>
            </div>
            <button
              onClick={() => writeContract(
                { address: market.address, abi: MARKET_ABI, functionName: "redeem" },
                {
                  onSuccess: () => { toast.success("Winnings claimed! 🎉"); onSuccess?.(); },
                  onError: (e) => toast.error(e.message.slice(0, 80)),
                }
              )}
              disabled={isProcessing}
              className="w-full py-3 rounded-lg font-bold text-background bg-cyan hover:brightness-110 shadow-cyan-glow disabled:opacity-50">
              {isProcessing ? "Processing..." : "Claim Winnings 🎉"}
            </button>
          </div>
        )}
        {position.hasRedeemed && <p className="text-center text-secondary text-sm">✓ Already claimed</p>}
        {!won && <p className="text-center text-secondary text-sm">You were on the losing side.</p>}
      </div>
    );
  }

  // ── Cancelled state ───────────────────────────────────────────────────────
  if (market.cancelled) {
    const has = position && (position.yesShares > 0n || position.noShares > 0n);
    return (
      <div className="glass rounded-xl p-5 space-y-4">
        <h3 className="font-semibold flex items-center gap-2 text-secondary">
          <AlertCircle size={16} />Market Cancelled
        </h3>
        {has && !position?.hasClaimedRefund && (
          <button
            onClick={() => writeContract(
              { address: market.address, abi: MARKET_ABI, functionName: "claimRefund" },
              {
                onSuccess: () => { toast.success("Refund claimed!"); onSuccess?.(); },
                onError: (e) => toast.error(e.message.slice(0, 80)),
              }
            )}
            disabled={isProcessing}
            className="w-full py-3 rounded-lg font-bold border border-border text-primary hover:bg-surface-2">
            {isProcessing ? "Processing..." : "Claim Refund"}
          </button>
        )}
        {position?.hasClaimedRefund && <p className="text-center text-secondary text-sm">✓ Refund claimed</p>}
      </div>
    );
  }

  // ── Paused state ──────────────────────────────────────────────────────────
  if (market.paused && !market.resolved && !market.cancelled) {
    return (
      <div className="glass rounded-xl p-5 text-center space-y-2">
        <AlertCircle size={20} className="text-yellow-400 mx-auto" />
        <p className="text-sm font-semibold text-yellow-400">Trading Paused</p>
        <p className="text-xs text-secondary">This market is temporarily paused by admin.</p>
      </div>
    );
  }

  // ── Main trading panel ─────────────────────────────────────────────────────
  return (
    <div className="glass rounded-xl overflow-hidden">
      {/* Live prob bar */}
      <div className="p-4 border-b border-border">
        <ProbabilityBar yesProb={market.yesProb} noProb={market.noProb} size="lg" />
      </div>

      <div className="p-5 space-y-4">
        {/* Fee info banner */}
        <div className="flex items-center gap-2 text-xs text-secondary bg-surface-3 rounded-lg px-3 py-2">
          <Info size={11} className="text-cyan/60 shrink-0" />
          <span>
            Platform fee: <span className="text-cyan font-bold">{platformFeeBps / 100}%</span>
            {" "}· Creator fee: <span className="text-purple font-bold">1%</span>
            {" "}· Net bet: <span className="text-primary font-bold">
              {((10_000 - platformFeeBps - 100) / 100).toFixed(0)}%
            </span>
          </span>
        </div>

        {/* YES / NO toggle */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-surface-3 rounded-lg">
          {(["YES", "NO"] as Side[]).map((s) => (
            <button key={s} onClick={() => setSide(s)}
              className={cn("py-2.5 rounded-md text-sm font-bold transition-all",
                side === s && s === "YES" && "bg-cyan text-background shadow-cyan-glow",
                side === s && s === "NO"  && "bg-pink text-background shadow-pink-glow",
                side !== s && "text-secondary hover:text-primary")}>
              {s} · {fmtProb(s === "YES" ? market.yesProb : market.noProb)}
            </button>
          ))}
        </div>

        {/* Amount input */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-secondary">Amount</label>
            {isConnected && (
              <span className="text-xs text-secondary font-mono">
                Balance: {fmtUSDM(balance)}
              </span>
            )}
          </div>
          <div className="relative">
            <input
              type="number"
              placeholder="0.00"
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              className="w-full bg-surface-3 border border-border rounded-lg px-4 py-3 text-lg font-mono text-primary placeholder-tertiary pr-24"
              min={MIN_BET_USDM}
              step="1"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <span className="text-secondary text-sm font-bold">USDM</span>
              {isConnected && balance > 0n && (
                <button
                  onClick={() => setRawInput(formatUnits(balance, USDM_DECIMALS))}
                  className="text-xs text-cyan/70 hover:text-cyan">
                  MAX
                </button>
              )}
            </div>
          </div>

          {/* Preset amounts */}
          <div className="flex gap-2 mt-2">
            {PRESETS.map((amt) => (
              <button key={amt} onClick={() => setRawInput(amt)}
                className={cn("flex-1 py-1 text-xs rounded font-mono border transition-colors",
                  rawInput === amt
                    ? "border-cyan/30 text-cyan bg-cyan/5"
                    : "border-border text-secondary hover:text-primary hover:border-cyan/20")}>
                ${amt}
              </button>
            ))}
          </div>
        </div>

        {/* Fee + payout breakdown */}
        {fees && betWei > 0n && (
          <div className="bg-surface-3 rounded-lg p-3 space-y-1.5 text-sm border border-border">
            <div className="flex justify-between">
              <span className="text-secondary">Platform fee ({platformFeeBps / 100}%)</span>
              <span className="font-mono text-secondary">{fmtUSDM(fees.platformFee)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary">Creator fee (1%)</span>
              <span className="font-mono text-secondary">{fmtUSDM(fees.creatorFee)}</span>
            </div>
            <div className="h-px bg-border my-1" />
            <div className="flex justify-between">
              <span className="text-secondary">Your shares</span>
              <span className="font-mono text-primary">{fmtUSDM(fees.net)}</span>
            </div>
            {estimate && (
              <>
                <div className="flex justify-between">
                  <span className="text-secondary">Est. payout (if {side} wins)</span>
                  <span className="font-mono font-bold text-cyan">{fmtUSDM(estimate.payout)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary">Multiplier</span>
                  <span className="font-mono text-primary">{estimate.multiplier.toFixed(2)}×</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Approval notice */}
        {needsApproval && betWei > 0n && (
          <div className="flex items-center gap-2 text-xs text-yellow-400 bg-yellow-400/5 border border-yellow-400/20 rounded-lg px-3 py-2">
            <ShieldCheck size={13} />
            Step 1: Approve USDM → Step 2: Buy shares (one-time approval per market)
          </div>
        )}

        {/* CTA */}
        {!isConnected ? (
          <div className="flex justify-center"><ConnectButton /></div>
        ) : needsApproval ? (
          <button
            onClick={handleApprove}
            disabled={isProcessing || betWei === 0n}
            className="w-full py-3.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 bg-purple text-background hover:brightness-110 disabled:opacity-50 transition-all">
            {isApproving
              ? <><span className="animate-spin">◌</span> Approving USDM...</>
              : <><ShieldCheck size={14} /> Step 1: Approve {rawInput} USDM</>
            }
          </button>
        ) : (
          <button
            onClick={handleBuy}
            disabled={!isOpen || isProcessing || betWei === 0n || insufficientBal}
            className={cn(
              "w-full py-3.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all",
              isOpen && betWei > 0n && !insufficientBal
                ? side === "YES"
                  ? "bg-cyan text-background hover:brightness-110 shadow-cyan-glow"
                  : "bg-pink text-background hover:brightness-110 shadow-pink-glow"
                : "bg-surface-3 text-tertiary cursor-not-allowed border border-border"
            )}>
            {isProcessing
              ? <><span className="animate-spin">◌</span> Processing...</>
              : insufficientBal
                ? "Insufficient USDM"
                : <><Zap size={14} />Step 2: Buy {side}{betWei > 0n ? ` · $${rawInput}` : ""}<ArrowRight size={14} /></>
            }
          </button>
        )}

        {!isOpen && !market.resolved && !market.cancelled && !market.paused && (
          <p className="text-center text-xs text-secondary">Trading ended. Awaiting resolution.</p>
        )}

        <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-secondary">
          <span>Total pool</span>
          <span className="font-mono text-primary">{fmtUSDM(market.totalPool)}</span>
        </div>
      </div>
    </div>
  );
}