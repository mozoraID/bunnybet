"use client";

import { use }   from "react";
import Image     from "next/image";
import Link      from "next/link";
import {
  ArrowLeft, ExternalLink, Clock, TrendingUp, CheckCircle, Copy,
} from "lucide-react";
import { useMarket }     from "@/hooks/useMarket";
import { BuySharesPanel } from "@/components/markets/BuySharesPanel";
import { ProbabilityBar } from "@/components/markets/ProbabilityBar";
import { type Address, getMarketStatus, CATEGORY_PRICE_PAIR } from "@/types/market";
import { useSinglePrice } from "@/hooks/usePrices";
import {
  fmtUSDM, fmtUSDMCompact, fmtEndDate, fmtTimeLeft, fmtProb,
  shortenAddress, addrUrl, cn,
} from "@/lib/utils";
import toast from "react-hot-toast";

export default function MarketPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = use(params);
  const { market, position, isLoading, refetch, refetchPosition } =
    useMarket(address as Address);

  if (isLoading) return <Skeleton />;

  if (!market) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="text-4xl mb-4">🐰</div>
        <h2 className="text-xl font-semibold mb-2">Market not found</h2>
        <Link href="/" className="text-green hover:underline text-sm">
          ← Back to markets
        </Link>
      </div>
    );
  }

  const status   = getMarketStatus(market);
  const hasPos   = position && (
    position.yesShares > 0n || position.noShares > 0n || position.hasRedeemed
  );
  const priceSym = CATEGORY_PRICE_PAIR[market.category];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-secondary hover:text-white text-sm mb-6 transition-colors"
      >
        <ArrowLeft size={14} /> All Markets
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left column ─────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Cover image */}
          {market.imageUrl && (
            <div className="relative w-full h-52 rounded-xl overflow-hidden">
              <Image
                src={market.imageUrl}
                alt={market.question}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 66vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/20 to-transparent" />
            </div>
          )}

          {/* Title + tags */}
          <div>
            <div className="flex flex-wrap gap-2 mb-3">
              <StatusBadge status={status} outcome={market.outcome} />
              <span className="text-xs text-secondary border border-border px-2.5 py-1 rounded-full">
                {market.category}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight">
              {market.question}
            </h1>
          </div>

          {/* Big probability block */}
          <div className="rounded-xl border border-border bg-bg-2 p-5">
            <ProbabilityBar
              yesProb={market.yesProb}
              noProb={market.noProb}
              size="lg"
            />
            <div className="grid grid-cols-2 gap-3 mt-4">
              {(["YES", "NO"] as const).map((s) => {
                const isYes = s === "YES";
                const prob  = isYes ? market.yesProb : market.noProb;
                const pool  = isYes ? market.yesPool  : market.noPool;
                return (
                  <div
                    key={s}
                    className={cn(
                      "rounded-lg p-4 border",
                      isYes ? "bg-green/5 border-green/15" : "bg-red/5 border-red/15"
                    )}
                  >
                    <div className={cn("text-xs font-bold mb-1", isYes ? "text-green" : "text-red")}>
                      {s}
                    </div>
                    <div className={cn("text-3xl font-bold tabular-nums", isYes ? "text-green" : "text-red")}>
                      {fmtProb(prob)}
                    </div>
                    <div className="text-xs text-secondary mt-1">
                      Pool: {fmtUSDM(pool)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Chainlink price */}
            <PriceContext sym={priceSym} />
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Volume"   value={fmtUSDMCompact(market.volume)}    icon={<TrendingUp size={13} />} />
            <Stat label="Pool"     value={fmtUSDM(market.totalPool)} />
            <Stat
              label={status === "open" ? "Time Left" : "Ended"}
              value={status === "open" ? fmtTimeLeft(market.timeLeft) : fmtEndDate(market.endTime)}
              icon={<Clock size={13} />}
              accent={status === "open" && market.timeLeft < 86400}
            />
            <Stat label="Currency" value="USDM" accent />
          </div>

          {/* Resolution criteria */}
          {market.description && (
            <div className="rounded-xl border border-border bg-bg-2 p-5">
              <h3 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-3">
                Resolution Criteria
              </h3>
              <p className="text-sm text-white/80 leading-relaxed">
                {market.description}
              </p>
            </div>
          )}

          {/* User position */}
          {hasPos && (
            <div className="rounded-xl border border-green/15 bg-green/5 p-5">
              <h3 className="text-sm font-semibold text-green mb-3 flex items-center gap-2">
                <CheckCircle size={14} /> Your Position
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {position.yesShares > 0n && (
                  <div>
                    <div className="text-xs text-secondary mb-1">YES Shares</div>
                    <div className="font-mono font-bold text-green">{fmtUSDM(position.yesShares)}</div>
                    <div className="text-xs text-secondary">Est: {fmtUSDM(position.estimatedYesPayout)}</div>
                  </div>
                )}
                {position.noShares > 0n && (
                  <div>
                    <div className="text-xs text-secondary mb-1">NO Shares</div>
                    <div className="font-mono font-bold text-red">{fmtUSDM(position.noShares)}</div>
                    <div className="text-xs text-secondary">Est: {fmtUSDM(position.estimatedNoPayout)}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Contract info */}
          <div className="rounded-xl border border-border bg-bg-2 p-4 space-y-2.5">
            <h3 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-3">
              Contract
            </h3>
            <InfoRow label="Market"  value={shortenAddress(market.address)} link={addrUrl(market.address)} copy={market.address} />
            <InfoRow label="Creator" value={shortenAddress(market.creator)} link={addrUrl(market.creator)} />
            <InfoRow label="Ends"    value={fmtEndDate(market.endTime)} />
          </div>
        </div>

        {/* ── Right column: sticky trade panel ────────────────────── */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-20">
            <BuySharesPanel
              market={market}
              position={position}
              onSuccess={() => { refetch(); refetchPosition(); }}
            />
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────

function PriceContext({ sym }: { sym: string | undefined }) {
  const p = useSinglePrice(sym);
  if (!p) return null;
  const up = p.change24h >= 0;
  return (
    <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-xs">
      <div className="flex items-center gap-2 font-mono">
        <span className="text-secondary">Oracle: {sym}/USD</span>
        <span className="text-white font-semibold">
          ${p.price.toLocaleString("en-US", { maximumFractionDigits: 0 })}
        </span>
        <span className={up ? "text-green" : "text-red"}>
          {up ? "+" : ""}{p.change24h.toFixed(2)}%
        </span>
      </div>
      <span className="text-tertiary">via Chainlink</span>
    </div>
  );
}

function StatusBadge({ status, outcome }: { status: string; outcome: boolean }) {
  const map: Record<string, string> = {
    open:      "text-green  border-green/25  bg-green/8",
    expired:   "text-secondary border-border bg-bg-3",
    resolved:  outcome ? "text-green border-green/25 bg-green/8" : "text-red border-red/25 bg-red/8",
    cancelled: "text-secondary border-border bg-bg-3",
    paused:    "text-amber border-amber/25 bg-amber/8",
  };
  const labels: Record<string, string> = {
    open:      "● Live",
    expired:   "Ended",
    resolved:  `Resolved · ${outcome ? "YES" : "NO"}`,
    cancelled: "Cancelled",
    paused:    "Paused",
  };
  return (
    <span className={cn("text-xs font-bold px-2.5 py-1 rounded-full border", map[status])}>
      {labels[status]}
    </span>
  );
}

function Stat({
  label, value, icon, accent,
}: { label: string; value: string; icon?: React.ReactNode; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-bg-2 p-3">
      <div className="flex items-center gap-1.5 text-xs text-secondary mb-1">{icon}{label}</div>
      <div className={cn("text-sm font-bold", accent ? "text-green" : "text-white")}>{value}</div>
    </div>
  );
}

function InfoRow({
  label, value, link, copy,
}: { label: string; value: string; link?: string; copy?: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-secondary">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-white">{value}</span>
        {link && (
          <a href={link} target="_blank" rel="noreferrer" className="text-secondary hover:text-green transition-colors">
            <ExternalLink size={11} />
          </a>
        )}
        {copy && (
          <button
            onClick={() => { navigator.clipboard.writeText(copy); toast.success("Copied!"); }}
            className="text-secondary hover:text-white transition-colors"
          >
            <Copy size={11} />
          </button>
        )}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 animate-fade-in">
      <div className="h-4 shimmer rounded w-24 mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="h-52 shimmer rounded-xl" />
          <div className="h-8 shimmer rounded w-3/4" />
          <div className="h-36 shimmer rounded-xl" />
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 shimmer rounded-lg" />
            ))}
          </div>
        </div>
        <div className="h-80 shimmer rounded-xl" />
      </div>
    </div>
  );
}
