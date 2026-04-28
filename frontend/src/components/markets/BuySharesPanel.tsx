"use client";

import { useState, useMemo }    from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ConnectButton }        from "@rainbow-me/rainbowkit";
import toast                    from "react-hot-toast";
import { formatUnits }          from "viem";
import {
  Zap, ArrowRight, CheckCircle, AlertCircle,
  ShieldCheck, Info, TrendingUp,
} from "lucide-react";
import { type Market, type UserPosition } from "@/types/market";
import { MARKET_ABI, MIN_BET_USDM, USDM_DECIMALS, txUrl } from "@/lib/contracts";
import {
  fmtUSDM, fmtProb, estimatePayout, calcFees, parseUSDMSafe, cn,
} from "@/lib/utils";
import { useUSDM }       from "@/hooks/useUSDM";
import { useSinglePrice, usePrices } from "@/hooks/usePrices";
import { ProbabilityBar } from "./ProbabilityBar";
import { CATEGORY_PRICE_PAIR } from "@/types/market";

type Side = "YES" | "NO";
const PRESETS = ["10", "50", "100", "500"];

export function BuySharesPanel({
  market,
  position,
  onSuccess,
}: {
  market:    Market;
  position:  UserPosition | null;
  onSuccess?: () => void;
}) {
  const { address: userAddress, isConnected } = useAccount();
  const [side,       setSide]       = useState<Side>("YES");
  const [rawInput,   setRawInput]   = useState("");
  const [isApproving, setApproving] = useState(false);

  const betWei = parseUSDMSafe(rawInput);
  const { balance, allowance, approve } = useUSDM(market.address);
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash });
  const isProcessing = isPending || isConfirming || isApproving;

  const platformFeeBps = market.platformFeeBps ?? 200;
  const fees    = useMemo(() => betWei > 0n ? calcFees(betWei, platformFeeBps) : null, [betWei, platformFeeBps]);
  const estimate = useMemo(() => {
    if (betWei === 0n) return null;
    return estimatePayout(
      betWei, platformFeeBps,
      side === "YES" ? market.yesPool : market.noPool,
      side === "YES" ? market.noPool  : market.yesPool,
    );
  }, [betWei, side, platformFeeBps, market.yesPool, market.noPool]);

  const isOpen          = !market.resolved && !market.cancelled && market.timeLeft > 0 && !market.paused;
  const needsApproval   = isConnected && betWei > 0n && allowance < betWei;
  const insufficientBal = isConnected && betWei > balance;

  // Chainlink price context
  const priceSym  = CATEGORY_PRICE_PAIR[market.category];
  const priceData = useSinglePrice(priceSym);

  async function handleApprove() {
    setApproving(true);
    try { await approve(market.address, betWei); }
    finally { setApproving(false); }
  }

  function handleBuy() {
    if (!isConnected || betWei === 0n || !isOpen || needsApproval) return;
    if (betWei < parseUSDMSafe(String(MIN_BET_USDM))) { toast.error(`Min bet: ${MIN_BET_USDM} USDM`); return; }
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
            <span>
              Buying {side}!{" "}
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

  function doWrite(fn: "redeem" | "claimRefund") {
    writeContract(
      { address: market.address, abi: MARKET_ABI, functionName: fn },
      {
        onSuccess: (hash) => {
          toast.success(fn === "redeem" ? "Winnings claimed! 🎉" : "Refund claimed!");
          onSuccess?.();
        },
        onError: (e) => toast.error(e.message.slice(0, 80)),
      }
    );
  }

  // ── Resolved ──────────────────────────────────────────────────────────────
  if (market.resolved && position) {
    const won = (market.outcome && position.yesShares > 0n)
             || (!market.outcome && position.noShares  > 0n);
    return (
      <div className="rounded-xl border border-border bg-bg-2 p-5 space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <CheckCircle size={16} className="text-green" /> Market Resolved
        </h3>
        <div className={cn(
          "rounded-lg p-4 text-center border",
          market.outcome ? "bg-green/6 border-green/20" : "bg-red/6 border-red/20"
        )}>
          <div className="text-2xl font-bold">
            {market.outcome ? <span className="text-green">YES</span> : <span className="text-red">NO</span>} won
          </div>
        </div>
        {won && !position.hasRedeemed && (
          <div className="space-y-2">
            <p className="text-sm text-secondary">
              Payout:{" "}
              <span className="text-green font-mono font-bold">
                {fmtUSDM(market.outcome ? position.estimatedYesPayout : position.estimatedNoPayout)}
              </span>
            </p>
            <button
              onClick={() => doWrite("redeem")}
              disabled={isProcessing}
              className="w-full py-3 rounded-lg font-bold text-bg bg-green hover:brightness-110 disabled:opacity-50 transition-all"
            >
              {isProcessing ? "Processing…" : "Claim Winnings 🎉"}
            </button>
          </div>
        )}
        {position.hasRedeemed && <p className="text-center text-sm text-secondary">✓ Already claimed</p>}
        {!won && <p className="text-center text-sm text-secondary">You were on the losing side.</p>}
      </div>
    );
  }

  // ── Cancelled ─────────────────────────────────────────────────────────────
  if (market.cancelled) {
    const has = position && (position.yesShares > 0n || position.noShares > 0n);
    return (
      <div className="rounded-xl border border-border bg-bg-2 p-5 space-y-4">
        <h3 className="font-semibold flex items-center gap-2 text-secondary">
          <AlertCircle size={16} /> Market Cancelled
        </h3>
        {has && !position?.hasClaimedRefund && (
          <button
            onClick={() => doWrite("claimRefund")}
            disabled={isProcessing}
            className="w-full py-3 rounded-lg font-bold border border-border text-white hover:bg-bg-3 disabled:opacity-50"
          >
            {isProcessing ? "Processing…" : "Claim Refund"}
          </button>
        )}
        {position?.hasClaimedRefund && <p className="text-center text-sm text-secondary">✓ Refund claimed</p>}
      </div>
    );
  }

  // ── Paused ────────────────────────────────────────────────────────────────
  if (market.paused && !market.resolved && !market.cancelled) {
    return (
      <div className="rounded-xl border border-amber/20 bg-amber/5 p-5 text-center space-y-2">
        <AlertCircle size={20} className="text-amber mx-auto" />
        <p className="text-sm font-semibold text-amber">Trading Paused</p>
        <p className="text-xs text-secondary">Temporarily paused by admin.</p>
      </div>
    );
  }

  // ── Main trading panel ─────────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-border bg-bg-2 overflow-hidden">
      {/* Header: live prob */}
      <div className="p-4 border-b border-border">
        <ProbabilityBar yesProb={market.yesProb} noProb={market.noProb} size="lg" />
        {priceData && (
          <div className="flex items-center gap-1.5 mt-3 text-xs text-secondary">
            <TrendingUp size={11} className="text-green/60" />
            <span className="font-mono">
              {priceSym}/USD: <span className="text-primary">${priceData.price.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
              <span className={priceData.change24h >= 0 ? " text-green" : " text-red"}>
                {" "}{priceData.change24h >= 0 ? "+" : ""}{priceData.change24h.toFixed(2)}%
              </span>
            </span>
            <span className="ml-auto text-tertiary text-[10px]">via Chainlink</span>
          </div>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Fee banner */}
        <div className="flex items-center gap-2 text-xs text-secondary bg-bg-3 rounded-lg px-3 py-2 border border-border">
          <Info size={11} className="shrink-0 text-secondary/60" />
          <span>
            Fee: <span className="text-white">{platformFeeBps / 100}%</span> platform
            {" + "}<span className="text-white">1%</span> creator
            {" = "}<span className="text-white">{(platformFeeBps + 100) / 100}%</span> total
          </span>
        </div>

        {/* YES / NO toggle */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-bg-3 rounded-lg border border-border">
          {(["YES", "NO"] as Side[]).map((s) => (
            <button
              key={s}
              onClick={() => setSide(s)}
              className={cn(
                "py-2.5 rounded-md text-sm font-bold transition-all",
                side === s && s === "YES" && "bg-green text-bg shadow-green-sm",
                side === s && s === "NO"  && "bg-red   text-white",
                side !== s && "text-secondary hover:text-white"
              )}
            >
              {s} · {fmtProb(s === "YES" ? market.yesProb : market.noProb)}
            </button>
          ))}
        </div>

        {/* Amount input */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-secondary">Amount</label>
            {isConnected && (
              <span className="text-xs font-mono text-secondary">
                Balance: {fmtUSDM(balance)}
              </span>
            )}
          </div>
          <div className="relative">
            <input
              type="number"
              placeholder="0"
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              className="w-full bg-bg-3 border border-border rounded-lg px-4 py-3 text-xl font-mono text-white placeholder-tertiary pr-24 focus:border-green/40 transition-colors"
              min={MIN_BET_USDM}
              step="1"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <span className="text-secondary text-sm font-semibold">USDM</span>
              {isConnected && balance > 0n && (
                <button
                  onClick={() => setRawInput(formatUnits(balance, USDM_DECIMALS))}
                  className="text-xs text-green/70 hover:text-green transition-colors"
                >
                  MAX
                </button>
              )}
            </div>
          </div>
          {/* Preset buttons */}
          <div className="flex gap-1.5 mt-2">
            {PRESETS.map((amt) => (
              <button
                key={amt}
                onClick={() => setRawInput(amt)}
                className={cn(
                  "flex-1 py-1.5 text-xs rounded font-mono border transition-colors",
                  rawInput === amt
                    ? "border-green/30 text-green bg-green/8"
                    : "border-border text-secondary hover:text-white hover:border-border-hi bg-bg-3"
                )}
              >
                ${amt}
              </button>
            ))}
          </div>
        </div>

        {/* Fee + payout breakdown */}
        {fees && betWei > 0n && (
          <div className="bg-bg-3 rounded-lg p-3 border border-border text-sm space-y-1.5">
            <Row label={`Platform fee (${platformFeeBps / 100}%)`} value={fmtUSDM(fees.platformFee)} dim />
            <Row label="Creator fee (1%)" value={fmtUSDM(fees.creatorFee)} dim />
            <div className="border-t border-border my-1" />
            <Row label="Your shares" value={fmtUSDM(fees.net)} />
            {estimate && (
              <>
                <Row
                  label={`Est. payout if ${side} wins`}
                  value={fmtUSDM(estimate.payout)}
                  accent
                />
                <Row label="Multiplier" value={`${estimate.multiplier.toFixed(2)}×`} />
              </>
            )}
          </div>
        )}

        {/* Approval notice */}
        {needsApproval && betWei > 0n && (
          <div className="flex items-center gap-2 text-xs text-amber bg-amber/5 border border-amber/20 rounded-lg px-3 py-2">
            <ShieldCheck size={13} />
            Step 1: Approve USDM → Step 2: Buy shares (one-time per market)
          </div>
        )}

        {/* CTA button */}
        {!isConnected ? (
          <div className="flex justify-center">
            <ConnectButton />
          </div>
        ) : needsApproval ? (
          <button
            onClick={handleApprove}
            disabled={isProcessing || betWei === 0n}
            className="w-full py-3.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 bg-purple text-white hover:brightness-110 disabled:opacity-50 transition-all"
          >
            {isApproving
              ? <><span className="animate-spin">◌</span> Approving USDM…</>
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
                  ? "bg-green text-bg hover:brightness-110 shadow-green-sm"
                  : "bg-red   text-white hover:brightness-110"
                : "bg-bg-3 text-tertiary cursor-not-allowed border border-border"
            )}
          >
            {isProcessing
              ? <><span className="animate-spin">◌</span> Processing…</>
              : insufficientBal
                ? "Insufficient USDM"
                : <>
                    <Zap size={14} />
                    Step 2: Buy {side}
                    {betWei > 0n && ` · $${rawInput}`}
                    <ArrowRight size={14} />
                  </>
            }
          </button>
        )}

        {!isOpen && !market.resolved && !market.cancelled && !market.paused && (
          <p className="text-center text-xs text-secondary">
            Trading closed. Awaiting resolution.
          </p>
        )}

        <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-secondary">
          <span>Total pool</span>
          <span className="font-mono text-white">{fmtUSDM(market.totalPool)}</span>
        </div>
      </div>
    </div>
  );
}

function Row({
  label, value, dim, accent,
}: {
  label: string; value: string; dim?: boolean; accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-secondary">{label}</span>
      <span className={cn(
        "font-mono",
        accent ? "text-green font-bold" : dim ? "text-secondary" : "text-white"
      )}>
        {value}
      </span>
    </div>
  );
}
