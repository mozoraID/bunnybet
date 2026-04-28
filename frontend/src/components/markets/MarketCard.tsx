"use client";

import Link            from "next/link";
import Image           from "next/image";
import { Clock, TrendingUp, Users } from "lucide-react";
import { type Market, getMarketStatus, CATEGORY_PRICE_PAIR } from "@/types/market";
import { ProbabilityBar, OutcomePill }  from "./ProbabilityBar";
import { useSinglePrice }               from "@/hooks/usePrices";
import { fmtUSDMCompact, fmtTimeLeft, fmtProb, cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { dot: string; text: string; label: string }> = {
  open:      { dot: "bg-green  animate-pulse-dot", text: "text-green",     label: "Live"      },
  expired:   { dot: "bg-secondary",                text: "text-secondary", label: "Ended"     },
  resolved:  { dot: "bg-purple",                   text: "text-purple",    label: "Resolved"  },
  cancelled: { dot: "bg-tertiary",                 text: "text-tertiary",  label: "Cancelled" },
  paused:    { dot: "bg-amber",                    text: "text-amber",     label: "Paused"    },
};

const CAT_STYLE: Record<string, string> = {
  Crypto:        "text-green/70",
  Politics:      "text-red/70",
  Sports:        "text-blue-400/70",
  Tech:          "text-purple/70",
  Finance:       "text-amber/70",
  Entertainment: "text-pink-400/70",
  Other:         "text-secondary",
};

function PriceChip({ category }: { category: string }) {
  const sym = CATEGORY_PRICE_PAIR[category];
  const price = useSinglePrice(sym);
  if (!price) return null;
  const up = price.change24h >= 0;
  return (
    <div className="flex items-center gap-1 text-xs font-mono">
      <span className="text-tertiary">{sym}/USD</span>
      <span className="text-primary">${price.price.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
      <span className={up ? "text-green" : "text-red"}>
        {up ? "▲" : "▼"}{Math.abs(price.change24h).toFixed(1)}%
      </span>
    </div>
  );
}

interface MarketCardProps {
  market:  Market;
  index?:  number;
}

export function MarketCard({ market, index = 0 }: MarketCardProps) {
  const status    = getMarketStatus(market);
  const stCfg     = STATUS_CONFIG[status];
  const catStyle  = CAT_STYLE[market.category] ?? CAT_STYLE.Other;
  const hasTrades = market.totalPool > 0n;

  return (
    <Link
      href={`/markets/${market.address}`}
      className={cn(
        "group block rounded-xl overflow-hidden",
        "border border-border hover:border-border-hi",
        "bg-bg-2 hover:bg-bg-3",
        "transition-all duration-200 hover:-translate-y-px",
        "animate-fade-up",
      )}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {/* Cover image */}
      {market.imageUrl && (
        <div className="relative h-36 overflow-hidden">
          <Image
            src={market.imageUrl}
            alt={market.question}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
          {/* Fade overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-bg-2 via-bg-2/20 to-transparent" />

          {/* Badges */}
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 bg-bg/75 backdrop-blur-sm rounded-full px-2 py-0.5">
            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", stCfg.dot)} />
            <span className={cn("text-xs font-medium", stCfg.text)}>{stCfg.label}</span>
          </div>
          <span className={cn("absolute top-2.5 right-2.5 text-xs font-medium", catStyle)}>
            {market.category}
          </span>
        </div>
      )}

      <div className="p-4">
        {/* No-image header */}
        {!market.imageUrl && (
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5">
              <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", stCfg.dot)} />
              <span className={cn("text-xs font-medium", stCfg.text)}>{stCfg.label}</span>
            </div>
            <span className={cn("text-xs font-medium", catStyle)}>{market.category}</span>
          </div>
        )}

        {/* Question */}
        <h3 className="text-sm font-semibold text-primary leading-snug line-clamp-2 mb-4 group-hover:text-white transition-colors">
          {market.question}
        </h3>

        {/* ─ PROBABILITY BAR — the hero element ─ */}
        <ProbabilityBar
          yesProb={market.yesProb}
          noProb={market.noProb}
          size="md"
          className="mb-3"
        />

        {/* Outcome chips */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <OutcomePill side="YES" prob={market.yesProb} />
          <OutcomePill side="NO"  prob={market.noProb}  />
          {status === "resolved" && (
            <span className={cn(
              "ml-auto text-xs font-bold px-2 py-0.5 rounded",
              market.outcome ? "text-green bg-green/10" : "text-red bg-red/10"
            )}>
              {market.outcome ? "✓ YES" : "✓ NO"}
            </span>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border pt-3 flex items-center justify-between text-xs text-secondary">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <TrendingUp size={10} />
              {fmtUSDMCompact(market.volume)}
            </span>
            {hasTrades && (
              <span className="flex items-center gap-1">
                <Users size={10} />
                {fmtUSDMCompact(market.totalPool)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <PriceChip category={market.category} />
            {status === "open"
              ? <span className="flex items-center gap-1"><Clock size={10} />{fmtTimeLeft(market.timeLeft)}</span>
              : <span className={stCfg.text}>{stCfg.label}</span>
            }
          </div>
        </div>
      </div>
    </Link>
  );
}

export function MarketCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <div
      className="rounded-xl border border-border bg-bg-2 overflow-hidden animate-fade-up"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="h-36 shimmer" />
      <div className="p-4 space-y-3">
        <div className="h-4 shimmer rounded w-3/4" />
        <div className="h-3 shimmer rounded w-1/2" />
        <div className="h-2.5 shimmer rounded-full" />
        <div className="flex gap-2">
          <div className="h-5 shimmer rounded-full w-20" />
          <div className="h-5 shimmer rounded-full w-20" />
        </div>
        <div className="flex justify-between pt-1 border-t border-border">
          <div className="h-3 shimmer rounded w-14" />
          <div className="h-3 shimmer rounded w-14" />
        </div>
      </div>
    </div>
  );
}
