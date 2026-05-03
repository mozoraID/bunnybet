"use client";

import { useState }               from "react";
import { useWalletClient }        from "wagmi";
import { useQuote }               from "@relayprotocol/relay-kit-hooks";
import { getClient }              from "@relayprotocol/relay-sdk";
import { parseUnits, formatUnits } from "viem";
import { AlertTriangle, ArrowRight, RefreshCw } from "lucide-react";
import {
  RELAY_CHAINS, RELAY_TOKENS, USDM_MEGAETH, MEGAETH_CHAIN_ID,
  BUNNYBET_APP_FEES, type RelayToken,
} from "@/lib/relay";
import { fmtUSDM, parseUSDMSafe, cn } from "@/lib/utils";
import { USDM_DECIMALS } from "@/lib/contracts";

const PRESETS = ["10", "50", "100", "500"];

export function RelayWithdrawWidget({
  userAddress, vaultBalance, onSuccess,
}: {
  userAddress: `0x${string}`; vaultBalance: bigint; onSuccess?: () => void;
}) {
  const { data: walletClient } = useWalletClient();

  const [toChain,   setToChain]   = useState(RELAY_CHAINS[0]);
  const [toToken,   setToToken]   = useState<RelayToken>(RELAY_TOKENS[1][0]);
  const [amount,    setAmount]    = useState("");
  const [isBusy,    setIsBusy]    = useState(false);
  const [txHash,    setTxHash]    = useState("");
  const [done,      setDone]      = useState(false);
  const [error,     setError]     = useState("");

  const tokens       = RELAY_TOKENS[toChain.id] ?? RELAY_TOKENS[1];
  const amtNum       = parseFloat(amount) || 0;
  const amtWei       = parseUSDMSafe(amount);
  const insufficient = amtWei > vaultBalance;

  const amountWei = amtNum > 0 && !insufficient
    ? parseUnits(amount as `${number}`, USDM_DECIMALS).toString()
    : "0";

  const relayClient = getClient();

  const { data: quote, isLoading: isQuoting, error: quoteError, executeQuote } = useQuote(
    relayClient,
    walletClient ?? undefined,
    amountWei !== "0" ? {
      user:               userAddress,
      originChainId:      MEGAETH_CHAIN_ID,
      destinationChainId: toChain.id,
      originCurrency:     USDM_MEGAETH,
      destinationCurrency: toToken.address,
      tradeType:          "EXACT_INPUT" as const,
      amount:             amountWei,
      appFees:            BUNNYBET_APP_FEES,
      referrer:           "bunnybet.xyz",
    } : undefined,
    undefined, undefined,
    { enabled: amountWei !== "0" }
  );

  const tokenOut = (quote as { details?: { currencyOut?: { amount?: string } } })
    ?.details?.currencyOut?.amount
    ? parseFloat(formatUnits(BigInt((quote as { details: { currencyOut: { amount: string } } }).details.currencyOut.amount), toToken.decimals)).toFixed(4)
    : null;

  async function execute() {
    if (!executeQuote) return;
    setIsBusy(true); setError("");
    try {
      await executeQuote((progress: unknown) => {
        const p = progress as { currentStepItem?: { txHashes?: string[] } };
        const hash = p.currentStepItem?.txHashes?.[0];
        if (hash) setTxHash(hash);
      });
      setDone(true); onSuccess?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message.slice(0, 120) : "Bridge failed");
    } finally { setIsBusy(false); }
  }

  if (done) return (
    <div className="border border-off-white/15 p-5 text-center space-y-3">
      <div className="text-3xl">✓</div>
      <p className="font-mono text-sm text-off-white font-bold">WITHDRAWAL COMPLETE</p>
      <p className="font-mono text-xs text-dim-2">{toToken.symbol} ARRIVING ON {toChain.name.toUpperCase()}</p>
      {txHash && <a href={`https://megaeth.blockscout.com/tx/${txHash}`} target="_blank" rel="noreferrer" className="block font-mono text-xs text-off-white/50 hover:text-off-white underline">VIEW TX →</a>}
      <button onClick={() => { setDone(false); setAmount(""); }} className="font-mono text-xs text-dim-2 hover:text-off-white border border-border-dark px-3 py-1.5">WITHDRAW AGAIN</button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between font-mono text-xs text-dim-2">
        <span>VAULT BALANCE</span><span className="text-off-white">{fmtUSDM(vaultBalance)}</span>
      </div>

      <div>
        <label className="font-mono text-[10px] text-dim-2 tracking-widest block mb-1.5">DESTINATION CHAIN</label>
        <div className="flex gap-1.5 flex-wrap">
          {RELAY_CHAINS.map((c) => (
            <button key={c.id} onClick={() => { setToChain(c); setToToken(RELAY_TOKENS[c.id]?.[0] ?? RELAY_TOKENS[1][0]); }}
              className={cn("px-2.5 py-1.5 font-mono text-xs border transition-all",
                toChain.id === c.id ? "border-off-white/40 text-off-white bg-off-white/8" : "border-border-dark text-dim-2 hover:text-off-white")}>
              {c.emoji} {c.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="font-mono text-[10px] text-dim-2 tracking-widest block mb-1.5">RECEIVE AS</label>
        <div className="flex gap-1.5 flex-wrap">
          {tokens.map((t) => (
            <button key={t.address} onClick={() => setToToken(t)}
              className={cn("px-2.5 py-1.5 font-mono text-xs border transition-all",
                toToken.address === t.address ? "border-off-white/40 text-off-white bg-off-white/8" : "border-border-dark text-dim-2 hover:text-off-white")}>
              {t.symbol}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className={cn("relative border bg-ink-4", insufficient && amount ? "border-red-400/40" : "border-border-dark focus-within:border-off-white/30")}>
          <input type="number" placeholder="0" value={amount}
            onChange={(e) => { setAmount(e.target.value); setError(""); }}
            className="w-full bg-transparent px-4 py-3 text-xl font-mono text-off-white placeholder-dim-2 pr-28"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <span className="font-mono text-xs text-dim-2">USDM</span>
            <button onClick={() => setAmount(parseFloat(formatUnits(vaultBalance, USDM_DECIMALS)).toFixed(2))}
              className="font-mono text-[10px] text-dim-2 hover:text-off-white border border-border-dark px-1.5 py-0.5">MAX</button>
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
        {insufficient && amount && <p className="font-mono text-[10px] text-red-400/80 mt-1">⚠ INSUFFICIENT VAULT BALANCE</p>}
      </div>

      <div className="border border-border-dark p-3 font-mono text-xs">
        <div className="flex items-center justify-between text-dim-2 mb-2">
          <span>ROUTE</span>
          {isQuoting && <RefreshCw size={10} className="animate-spin" />}
        </div>
        <div className="flex items-center gap-2">
          <span className="border border-off-white/20 px-2 py-0.5 text-off-white">USDM / MegaETH</span>
          <ArrowRight size={12} className="text-dim-2" />
          <span className="border border-border-dark px-2 py-0.5 text-off-white">{toToken.symbol} / {toChain.name}</span>
        </div>
        {tokenOut && (
          <div className="mt-2.5 pt-2 border-t border-border-dark text-[10px] text-dim-2">
            <div className="flex justify-between"><span>YOU RECEIVE (EST.)</span><span className="text-off-white font-bold">{tokenOut} {toToken.symbol}</span></div>
          </div>
        )}
      </div>

      {(error || quoteError) && (
        <div className="border border-red-400/30 bg-red-400/5 p-3 font-mono text-xs text-red-400/90 flex gap-2">
          <AlertTriangle size={11} className="shrink-0 mt-0.5" />
          {error || (quoteError as Error)?.message?.slice(0, 100)}
        </div>
      )}
      {isBusy && <p className="font-mono text-xs text-dim-2 text-center animate-pulse">BRIDGING...</p>}

      <button onClick={execute}
        disabled={isBusy || isQuoting || !quote || !executeQuote || amtNum <= 0 || insufficient}
        className={cn("w-full py-3.5 font-mono text-xs tracking-widest font-bold transition-all",
          !isBusy && !isQuoting && quote && amtNum > 0 && !insufficient
            ? "bg-off-white text-ink hover:bg-cream"
            : "bg-ink-4 text-dim-2 cursor-not-allowed border border-border-dark")}>
        {isBusy ? "BRIDGING..." : isQuoting ? "GETTING QUOTE..." : !quote ? "ENTER AMOUNT" : `WITHDRAW ${amount} USDM → ${toToken.symbol} (${toChain.name})`}
      </button>
    </div>
  );
}
