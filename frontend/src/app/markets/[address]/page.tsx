"use client";

import { use }   from "react";
import Image     from "next/image";
import Link      from "next/link";
import { ExternalLink, Copy } from "lucide-react";
import { useMarket }     from "@/hooks/useMarket";
import { BuySharesPanel } from "@/components/markets/BuySharesPanel";
import { ProbabilityBar } from "@/components/markets/ProbabilityBar";
import { useSinglePrice } from "@/hooks/usePrices";
import { type Address, getMarketStatus, CATEGORY_PRICE_PAIR } from "@/types/market";
import { fmtUSDM, fmtUSDMCompact, fmtEndDate, fmtTimeLeft, fmtProb, shortenAddress, addrUrl, cn } from "@/lib/utils";
import toast from "react-hot-toast";

export default function MarketPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = use(params);
  const { market, position, isLoading, refetch, refetchPosition } = useMarket(address as Address);

  if (isLoading) return <Skeleton />;
  if (!market) return (
    <div className="max-w-4xl mx-auto px-4 py-16 text-center font-mono">
      <p className="text-dim-2 text-xs tracking-widest mb-4">MARKET NOT FOUND</p>
      <Link href="/" className="text-off-white underline text-xs">← BACK TO MARKETS</Link>
    </div>
  );

  const status   = getMarketStatus(market);
  const isOpen   = status === "open";
  const hasPos   = position && (position.yesShares > 0n || position.noShares > 0n || position.hasRedeemed);
  const priceSym = CATEGORY_PRICE_PAIR[market.category];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
      <Link href="/" className="inline-block font-mono text-xs text-dim-2 hover:text-off-white tracking-widest mb-6 transition-colors">
        ← MARKETS
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left ──────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Cover */}
          {market.imageUrl && (
            <div className="relative w-full h-48 overflow-hidden bg-cream-3">
              <Image src={market.imageUrl} alt={market.question} fill className="object-cover"
                sizes="(max-width:1024px) 100vw, 66vw" />
            </div>
          )}

          {/* Status + category */}
          <div className="flex flex-wrap gap-2">
            <span className={cn("font-mono text-xs tracking-widest px-2 py-1 border",
              isOpen ? "text-off-white border-off-white/30" : "text-dim-2 border-border-dark")}>
              {status.toUpperCase()}
              {status === "resolved" && ` · ${market.outcome ? "YES" : "NO"}`}
            </span>
            <span className="font-mono text-xs text-dim-2 border border-border-dark px-2 py-1">
              {market.category.toUpperCase()}
            </span>
          </div>

          {/* Question — BIG BOLD headline */}
          <h1 className="font-sans font-black text-off-white uppercase leading-none"
            style={{ fontSize: "clamp(1.4rem, 3vw, 2.2rem)", letterSpacing: "-0.01em" }}>
            {market.question}
          </h1>

          {/* Big prob block */}
          <div className="card-dark p-5">
            <ProbabilityBar yesProb={market.yesProb} noProb={market.noProb} size="lg" dark />
            <div className="grid grid-cols-2 gap-3 mt-4">
              {(["YES","NO"] as const).map((s) => {
                const isYes = s === "YES";
                return (
                  <div key={s} className="terminal-box p-4">
                    <div className="font-mono text-xs text-dim-2 tracking-widest mb-1">{s}</div>
                    <div className={cn("text-3xl font-mono font-bold", isYes ? "text-off-white" : "text-dim-2")}>
                      {fmtProb(isYes ? market.yesProb : market.noProb)}
                    </div>
                    <div className="font-mono text-xs text-dim-2 mt-1">
                      POOL: {fmtUSDM(isYes ? market.yesPool : market.noPool)}
                    </div>
                  </div>
                );
              })}
            </div>
            <PriceContext sym={priceSym} />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <MiniStat label="VOLUME"   value={fmtUSDMCompact(market.volume)} />
            <MiniStat label="POOL"     value={fmtUSDM(market.totalPool)} />
            <MiniStat label={isOpen ? "TIME LEFT" : "ENDED"} value={isOpen ? fmtTimeLeft(market.timeLeft) : fmtEndDate(market.endTime)} />
            <MiniStat label="CURRENCY" value="USDM" />
          </div>

          {/* Description */}
          {market.description && (
            <div className="card-dark p-5">
              <div className="font-mono text-[10px] text-dim-2 tracking-widest mb-3">RESOLUTION CRITERIA</div>
              <p className="font-mono text-xs text-off-white/80 leading-relaxed">{market.description}</p>
            </div>
          )}

          {/* User position */}
          {hasPos && (
            <div className="border border-off-white/15 bg-off-white/5 p-5">
              <div className="font-mono text-[10px] text-dim-2 tracking-widest mb-3">YOUR POSITION</div>
              <div className="grid grid-cols-2 gap-3 font-mono text-sm">
                {position.yesShares > 0n && (
                  <div>
                    <div className="text-[10px] text-dim-2 mb-1">YES SHARES</div>
                    <div className="font-bold text-off-white">{fmtUSDM(position.yesShares)}</div>
                    <div className="text-[10px] text-dim-2">EST: {fmtUSDM(position.estimatedYesPayout)}</div>
                  </div>
                )}
                {position.noShares > 0n && (
                  <div>
                    <div className="text-[10px] text-dim-2 mb-1">NO SHARES</div>
                    <div className="font-bold text-dim-2">{fmtUSDM(position.noShares)}</div>
                    <div className="text-[10px] text-dim-2">EST: {fmtUSDM(position.estimatedNoPayout)}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Contract info */}
          <div className="terminal-box p-4 space-y-2.5">
            <div className="font-mono text-[10px] text-dim-2 tracking-widest mb-3">CONTRACT INFO</div>
            <InfoRow label="MARKET"  value={shortenAddress(market.address)} link={addrUrl(market.address)} copy={market.address} />
            <InfoRow label="CREATOR" value={shortenAddress(market.creator)} link={addrUrl(market.creator)} />
            <InfoRow label="ENDS"    value={fmtEndDate(market.endTime)} />
            <InfoRow label="CHAIN"   value="MEGAETH (4326)" />
          </div>
        </div>

        {/* ── Right: sticky trade panel ──────────────────────────── */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-16">
            <BuySharesPanel market={market} position={position}
              onSuccess={() => { refetch(); refetchPosition(); }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function PriceContext({ sym }: { sym: string | undefined }) {
  const p = useSinglePrice(sym);
  if (!p) return null;
  return (
    <div className="mt-4 pt-4 border-t border-border-dark flex justify-between font-mono text-xs">
      <span className="text-dim-2">ORACLE: {sym}/USD — ${p.price.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
      <span className="text-dim-2/60">VIA CHAINLINK</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="terminal-box p-3">
      <div className="font-mono text-[10px] text-dim-2 tracking-widest mb-1">{label}</div>
      <div className="font-mono text-sm font-bold text-off-white">{value}</div>
    </div>
  );
}

function InfoRow({ label, value, link, copy }: { label: string; value: string; link?: string; copy?: string }) {
  return (
    <div className="flex items-center justify-between font-mono text-xs">
      <span className="text-dim-2">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-off-white">{value}</span>
        {link && <a href={link} target="_blank" rel="noreferrer" className="text-dim-2 hover:text-off-white"><ExternalLink size={10} /></a>}
        {copy && <button onClick={() => { navigator.clipboard.writeText(copy); toast.success("COPIED"); }} className="text-dim-2 hover:text-off-white"><Copy size={10} /></button>}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 animate-fade-in">
      <div className="h-3 shimmer rounded w-24 mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="h-48 shimmer" />
          <div className="h-8 shimmer w-3/4" />
          <div className="h-36 shimmer" />
        </div>
        <div className="h-80 shimmer" />
      </div>
    </div>
  );
}
