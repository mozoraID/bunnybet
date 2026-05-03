"use client";

import { useState, useEffect }        from "react";
import { useWalletClient }            from "wagmi";
import { useQuote }                   from "@relayprotocol/relay-kit-hooks";
import { getClient }                  from "@relayprotocol/relay-sdk";
import { parseUnits, formatUnits }    from "viem";
import { AlertTriangle, Info, ArrowRight, RefreshCw } from "lucide-react";
import {
  RELAY_CHAINS, RELAY_TOKENS, USDM_MEGAETH, MEGAETH_CHAIN_ID,
  BUNNYBET_APP_FEES, type RelayToken,
} from "@/lib/relay";
import { cn } from "@/lib/utils";

const MIN_USD = 3;

export function RelayDepositWidget({
  userAddress,
  onSuccess,
}: {
  userAddress: `0x${string}`;
  onSuccess?: () => void;
}) {
  const { data: walletClient } = useWalletClient();

  const [fromChain, setFromChain] = useState(RELAY_CHAINS[0]);
  const [fromToken, setFromToken] = useState<RelayToken>(RELAY_TOKENS[1][0]);
  const [amount,    setAmount]    = useState("");
  const [isBusy,    setIsBusy]    = useState(false);
  const [txHash,    setTxHash]    = useState("");
  const [done,      setDone]      = useState(false);
  const [error,     setError]     = useState("");

  const tokens = RELAY_TOKENS[fromChain.id] ?? RELAY_TOKENS[1];
  const amtNum = parseFloat(amount) || 0;

  const amountWei = amtNum >= MIN_USD
    ? parseUnits(amount as `${number}`, fromToken.decimals).toString()
    : "0";

  const relayClient = getClient();

  const {
    data:         quote,
    isLoading:    isQuoting,
    error:        quoteError,
    executeQuote,
  } = useQuote(
    relayClient,
    walletClient ?? undefined,
    amountWei !== "0" ? {
      user:               userAddress,
      originChainId:      fromChain.id,
      destinationChainId: MEGAETH_CHAIN_ID,
      originCurrency:     fromToken.address,
      destinationCurrency: USDM_MEGAETH,
      tradeType:          "EXACT_INPUT" as const,
      amount:             amountWei,
      appFees:            BUNNYBET_APP_FEES,
      referrer:           "bunnybet.xyz",
    } : undefined,
    undefined,
    undefined,
    { enabled: amountWei !== "0" }
  );

  const usdmOut = (quote as { details?: { currencyOut?: { amount?: string } } })
    ?.details?.currencyOut?.amount
    ? parseFloat(formatUnits(BigInt((quote as { details: { currencyOut: { amount: string } } }).details.currencyOut.amount), 18)).toFixed(2)
    : null;

  const totalFeeUsd = (quote as { details?: { totalFees?: { usd?: string } } })
    ?.details?.totalFees?.usd ?? null;

  async function execute() {
    if (!executeQuote) return;
    setIsBusy(true); setError("");
    try {
      await executeQuote((progress: unknown) => {
        const p = progress as { currentStepItem?: { txHashes?: string[] } };
        const hash = p.currentStepItem?.txHashes?.[0];
        if (hash) setTxHash(hash);
      });
      setDone(true);
      onSuccess?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message.slice(0, 120) : "Bridge failed");
    } finally { setIsBusy(false); }
  }

  if (done) return (
    <div className="border border-off-white/15 p-5 text-center space-y-3">
      <div className="text-3xl">✓</div>
      <p className="font-mono text-sm text-off-white font-bold">BRIDGE COMPLETE</p>
      <p className="font-mono text-xs text-dim-2">USDM ARRIVING ON MEGAETH IN ~1-3 MIN</p>
      {txHash && (
        <a href={`https://megaeth.blockscout.com/tx/${txHash}`} target="_blank" rel="noreferrer"
          className="block font-mono text-xs text-off-white/50 hover:text-off-white underline">VIEW TX →</a>
      )}
      <button onClick={() => { setDone(false); setAmount(""); setTxHash(""); }}
        className="font-mono text-xs text-dim-2 hover:text-off-white border border-border-dark px-3 py-1.5">
        DEPOSIT AGAIN
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="border border-off-white/8 p-3 font-mono text-xs text-dim-2 flex gap-2">
        <Info size={11} className="shrink-0 mt-0.5 text-off-white/30" />
        <span>DEPOSIT FROM ANY CHAIN → AUTO SWAP+BRIDGE → <span className="text-off-white">USDM ON MEGAETH</span>. 0.01% BUNNYBET FEE.</span>
      </div>

      <div>
        <label className="font-mono text-[10px] text-dim-2 tracking-widest block mb-1.5">FROM CHAIN</label>
        <div className="flex gap-1.5 flex-wrap">
          {RELAY_CHAINS.map((c) => (
            <button key={c.id} onClick={() => { setFromChain(c); setFromToken(RELAY_TOKENS[c.id]?.[0] ?? RELAY_TOKENS[1][0]); }}
              className={cn("px-2.5 py-1.5 font-mono text-xs border transition-all",
                fromChain.id === c.id ? "border-off-white/40 text-off-white bg-off-white/8" : "border-border-dark text-dim-2 hover:text-off-white")}>
              {c.emoji} {c.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="font-mono text-[10px] text-dim-2 tracking-widest block mb-1.5">TOKEN</label>
        <div className="flex gap-1.5 flex-wrap">
          {tokens.map((t) => (
            <button key={t.address} onClick={() => setFromToken(t)}
              className={cn("px-2.5 py-1.5 font-mono text-xs border transition-all",
                fromToken.address === t.address ? "border-off-white/40 text-off-white bg-off-white/8" : "border-border-dark text-dim-2 hover:text-off-white")}>
              {t.symbol}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="font-mono text-[10px] text-dim-2 tracking-widest block mb-1.5">AMOUNT — MIN ~${MIN_USD} USD VALUE</label>
        <div className="relative border border-border-dark bg-ink-4 focus-within:border-off-white/30">
          <input type="number" placeholder="0" value={amount}
            onChange={(e) => { setAmount(e.target.value); setError(""); }}
            className="w-full bg-transparent px-4 py-3 text-xl font-mono text-off-white placeholder-dim-2 pr-20"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-dim-2 font-bold">{fromToken.symbol}</span>
        </div>
      </div>

      <div className="border border-border-dark p-3 font-mono text-xs">
        <div className="flex items-center justify-between text-dim-2 mb-2">
          <span>ROUTE</span>
          {isQuoting && <RefreshCw size={10} className="animate-spin" />}
        </div>
        <div className="flex items-center gap-2">
          <span className="border border-border-dark px-2 py-0.5 text-off-white">{fromToken.symbol} / {fromChain.name}</span>
          <ArrowRight size={12} className="text-dim-2" />
          <span className="border border-off-white/20 px-2 py-0.5 text-off-white">USDM / MegaETH</span>
        </div>
        {usdmOut && (
          <div className="mt-2.5 pt-2 border-t border-border-dark space-y-1 text-[10px] text-dim-2">
            <div className="flex justify-between"><span>YOU RECEIVE (EST.)</span><span className="text-off-white font-bold">{usdmOut} USDM</span></div>
            {totalFeeUsd && <div className="flex justify-between"><span>TOTAL FEES</span><span>~${parseFloat(totalFeeUsd).toFixed(3)}</span></div>}
          </div>
        )}
        {!quote && !isQuoting && amtNum > 0 && amtNum < MIN_USD && (
          <p className="mt-2 text-[10px] text-red-400/80">⚠ MIN ~${MIN_USD} USD VALUE</p>
        )}
      </div>

      {(error || quoteError) && (
        <div className="border border-red-400/30 bg-red-400/5 p-3 font-mono text-xs text-red-400/90 flex gap-2">
          <AlertTriangle size={11} className="shrink-0 mt-0.5" />
          {error || (quoteError as Error)?.message?.slice(0, 100)}
        </div>
      )}
      {isBusy && <p className="font-mono text-xs text-dim-2 text-center animate-pulse">BRIDGING... SIGN IN YOUR WALLET</p>}

      <button onClick={execute}
        disabled={isBusy || isQuoting || !quote || !executeQuote || amtNum < MIN_USD}
        className={cn("w-full py-3.5 font-mono text-xs tracking-widest font-bold transition-all",
          !isBusy && !isQuoting && quote && amtNum >= MIN_USD
            ? "bg-off-white text-ink hover:bg-cream"
            : "bg-ink-4 text-dim-2 cursor-not-allowed border border-border-dark")}>
        {isBusy ? "BRIDGING..." : isQuoting ? "GETTING QUOTE..." : !quote ? (amtNum > 0 ? "ENTER MIN $3 VALUE" : "ENTER AMOUNT") : `BRIDGE ${amount} ${fromToken.symbol} → USDM`}
      </button>
    </div>
  );
}
