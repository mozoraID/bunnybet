"use client";
import Link  from "next/link";
import Image from "next/image";
import { Clock, TrendingUp, Flame } from "lucide-react";
import { type Market, getMarketStatus } from "@/types/market";
import { ProbabilityBar, OddsChip }     from "./ProbabilityBar";
import { fmtUSDMCompact, fmtTimeLeft, cn } from "@/lib/utils";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  open:      { label: "● LIVE",     cls: "text-cyan  bg-cyan/10  border-cyan/20"  },
  expired:   { label: "ENDED",      cls: "text-muted bg-muted/10 border-muted/20" },
  resolved:  { label: "RESOLVED",   cls: "text-purple bg-purple/10 border-purple/20" },
  cancelled: { label: "CANCELLED",  cls: "text-secondary bg-surface-2 border-border" },
};
const CAT_CLR: Record<string, string> = {
  Crypto: "text-cyan bg-cyan/10", Politics: "text-pink bg-pink/10",
  Sports: "text-green-400 bg-green-400/10", Tech: "text-purple bg-purple/10",
  Finance: "text-yellow-400 bg-yellow-400/10", Entertainment: "text-orange-400 bg-orange-400/10",
  Other: "text-secondary bg-surface-2",
};

export function MarketCard({ market, featured = false, index = 0 }: { market: Market; featured?: boolean; index?: number }) {
  const status  = getMarketStatus(market);
  const badge   = STATUS_BADGE[status];
  const catCls  = CAT_CLR[market.category] ?? CAT_CLR.Other;

  return (
    <Link href={`/markets/${market.address}`}
      className="group block rounded-xl overflow-hidden glass border border-border hover:border-glow hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300 animate-slide-up"
      style={{ animationDelay: `${index * 40}ms`, animationFillMode: "both" }}>

      {market.imageUrl && (
        <div className={cn("relative overflow-hidden", featured ? "h-48" : "h-32")}>
          <Image src={market.imageUrl} alt={market.question} fill className="object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} sizes="(max-width:768px) 100vw, 33vw" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          <span className={cn("absolute top-3 left-3 text-xs font-bold px-2 py-0.5 rounded border", badge.cls)}>{badge.label}</span>
          <span className={cn("absolute top-3 right-3 text-xs font-medium px-2 py-0.5 rounded", catCls)}>{market.category}</span>
        </div>
      )}

      <div className="p-4">
        {!market.imageUrl && (
          <div className="flex justify-between mb-2">
            <span className={cn("text-xs font-bold px-2 py-0.5 rounded border", badge.cls)}>{badge.label}</span>
            <span className={cn("text-xs px-2 py-0.5 rounded", catCls)}>{market.category}</span>
          </div>
        )}

        <h3 className={cn("font-semibold text-primary leading-snug mb-3 line-clamp-2 group-hover:text-white transition-colors", featured ? "text-lg" : "text-sm")}>
          {market.question}
        </h3>

        <ProbabilityBar yesProb={market.yesProb} noProb={market.noProb} size={featured ? "lg" : "md"} className="mb-3" />

        <div className="flex items-center gap-2 mb-3">
          <OddsChip side="YES" prob={market.yesProb} />
          <OddsChip side="NO"  prob={market.noProb}  />
          {status === "resolved" && (
            <span className={cn("text-xs font-bold px-2 py-0.5 rounded", market.outcome ? "text-cyan bg-cyan/15" : "text-pink bg-pink/15")}>
              {market.outcome ? "✓ YES" : "✓ NO"}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-secondary">
          <span className="flex items-center gap-1">
            <TrendingUp size={11} className="text-cyan/60" />
            {fmtUSDMCompact(market.volume)}
          </span>
          {status === "open"
            ? <span className="flex items-center gap-1"><Clock size={11} />{fmtTimeLeft(market.timeLeft)}</span>
            : <span className="text-purple text-xs">{status}</span>
          }
        </div>
      </div>
    </Link>
  );
}

export function MarketCardSkeleton() {
  return (
    <div className="rounded-xl glass border border-border overflow-hidden animate-pulse">
      <div className="h-32 bg-surface-2" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-surface-2 rounded w-3/4" />
        <div className="h-3 bg-surface-3 rounded-full" />
        <div className="flex gap-2"><div className="h-5 bg-surface-2 rounded-full w-20" /><div className="h-5 bg-surface-2 rounded-full w-20" /></div>
      </div>
    </div>
  );
}
