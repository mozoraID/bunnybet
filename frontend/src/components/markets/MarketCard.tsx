"use client";

import Link            from "next/link";
import Image           from "next/image";
import { type Market, getMarketStatus, CATEGORY_PRICE_PAIR } from "@/types/market";
import { ProbabilityBar, OutcomePill } from "./ProbabilityBar";
import { useSinglePrice }              from "@/hooks/usePrices";
import { fmtUSDMCompact, fmtTimeLeft, cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  open: "LIVE", expired: "ENDED", resolved: "RESOLVED",
  cancelled: "CANCELLED", paused: "PAUSED",
};

function PriceTag({ category }: { category: string }) {
  const sym  = CATEGORY_PRICE_PAIR[category];
  const data = useSinglePrice(sym);
  if (!data) return null;
  const up = data.change24h >= 0;
  return (
    <span className="font-mono text-[10px] text-gray-2 flex items-center gap-1">
      {sym} ${data.price.toLocaleString("en-US", { maximumFractionDigits: 0 })}
      <span className={up ? "text-gray-1" : "text-gray-3"}>
        {up ? "▲" : "▼"}{Math.abs(data.change24h).toFixed(1)}%
      </span>
    </span>
  );
}

export function MarketCard({ market, index = 0 }: { market: Market; index?: number }) {
  const status = getMarketStatus(market);
  const isOpen = status === "open";

  return (
    <Link
      href={`/markets/${market.address}`}
      className={cn(
        "group block bg-cream border border-border-light",
        "hover:bg-cream-2 hover:shadow-card-hover",
        "transition-all duration-200",
        "animate-fade-up",
        "overflow-hidden",
      )}
      style={{ animationDelay: `${index * 35}ms` }}
    >
      {/* Cover image */}
      {market.imageUrl && (
        <div className="relative h-32 overflow-hidden bg-cream-3">
          <Image
            src={market.imageUrl}
            alt={market.question}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-cream via-cream/10 to-transparent" />
        </div>
      )}

      <div className="p-4">
        {/* Status + category row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={cn(
              "font-mono text-[10px] tracking-widest px-1.5 py-0.5 border",
              isOpen
                ? "text-black border-black/30 bg-black/5"
                : "text-gray-3 border-black/10"
            )}>
              {STATUS_LABEL[status] ?? status.toUpperCase()}
              {isOpen && <span className="ml-1 animate-pulse-dot inline-block w-1.5 h-1.5 rounded-full bg-black/50 mb-0.5" />}
            </span>
            {status === "resolved" && (
              <span className="font-mono text-[10px] tracking-widest text-gray-1 border border-black/20 px-1.5 py-0.5">
                {market.outcome ? "YES" : "NO"} ✓
              </span>
            )}
          </div>
          <span className="font-mono text-[10px] text-gray-3 uppercase tracking-widest">
            {market.category}
          </span>
        </div>

        {/* Question — heavy bold black */}
        <h3 className={cn(
          "font-sans font-black text-black leading-tight line-clamp-2 mb-4",
          "text-sm group-hover:opacity-80 transition-opacity",
          "uppercase tracking-tight"
        )}>
          {market.question}
        </h3>

        {/* ─ Probability bar ─ */}
        <ProbabilityBar
          yesProb={market.yesProb}
          noProb={market.noProb}
          size="md"
          dark={false}
          className="mb-3"
        />

        {/* Outcome pills */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <OutcomePill side="YES" prob={market.yesProb} dark={false} />
          <OutcomePill side="NO"  prob={market.noProb}  dark={false} />
        </div>

        {/* Footer */}
        <div className="border-t border-black/8 pt-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] text-gray-2">
              VOL {fmtUSDMCompact(market.volume)}
            </span>
            <PriceTag category={market.category} />
          </div>
          <span className="font-mono text-[10px] text-gray-3">
            {isOpen ? fmtTimeLeft(market.timeLeft) : STATUS_LABEL[status]}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function MarketCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <div className="bg-cream border border-border-light animate-fade-up"
      style={{ animationDelay: `${index * 35}ms` }}>
      <div className="h-32 shimmer-light" />
      <div className="p-4 space-y-3">
        <div className="h-3 shimmer-light rounded w-1/4" />
        <div className="h-5 shimmer-light rounded w-full" />
        <div className="h-4 shimmer-light rounded w-3/4" />
        <div className="h-2.5 shimmer-light rounded-none" />
        <div className="flex gap-2">
          <div className="h-5 shimmer-light rounded w-20" />
          <div className="h-5 shimmer-light rounded w-20" />
        </div>
        <div className="flex justify-between pt-1 border-t border-black/8">
          <div className="h-3 shimmer-light rounded w-16" />
          <div className="h-3 shimmer-light rounded w-16" />
        </div>
      </div>
    </div>
  );
}
