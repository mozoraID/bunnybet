"use client";
import { use }     from "react";
import Image       from "next/image";
import Link        from "next/link";
import { ArrowLeft, ExternalLink, Clock, Users, TrendingUp, CheckCircle, Copy } from "lucide-react";
import { useMarket }     from "@/hooks/useMarket";
import { BuySharesPanel } from "@/components/markets/BuySharesPanel";
import { ProbabilityBar } from "@/components/markets/ProbabilityBar";
import { type Address, getMarketStatus } from "@/types/market";
import { fmtUSDM, fmtUSDMCompact, fmtEndDate, fmtTimeLeft, fmtProb, shortenAddress, addrUrl, cn } from "@/lib/utils";
import toast from "react-hot-toast";

export default function MarketPage({ params }: { params: Promise<{ address: string }> }) {
  const { address }   = use(params);
  const { market, position, isLoading, refetch, refetchPosition } = useMarket(address as Address);

  if (isLoading) return <Skeleton />;
  if (!market) return (
    <div className="max-w-4xl mx-auto px-4 py-16 text-center">
      <div className="text-5xl mb-4">🐰</div>
      <h2 className="text-xl font-semibold mb-2">Market not found</h2>
      <Link href="/" className="text-cyan hover:underline">← Back to markets</Link>
    </div>
  );

  const status     = getMarketStatus(market);
  const hasPos     = position && (position.yesShares > 0n || position.noShares > 0n || position.hasRedeemed);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
      <Link href="/" className="inline-flex items-center gap-1.5 text-secondary hover:text-primary text-sm mb-6"><ArrowLeft size={14} />All Markets</Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: info */}
        <div className="lg:col-span-2 space-y-5">
          {market.imageUrl && (
            <div className="relative w-full h-48 sm:h-64 rounded-xl overflow-hidden">
              <Image src={market.imageUrl} alt={market.question} fill className="object-cover" sizes="(max-width:1024px) 100vw, 66vw" />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
            </div>
          )}

          <div>
            <div className="flex flex-wrap gap-2 mb-3">
              <StatusBadge status={status} outcome={market.outcome} />
              <span className="text-xs text-secondary bg-surface-2 border border-border px-2.5 py-1 rounded-full">{market.category}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-primary leading-tight">{market.question}</h1>
          </div>

          {/* Big prob bar */}
          <div className="glass rounded-xl p-5">
            <ProbabilityBar yesProb={market.yesProb} noProb={market.noProb} size="lg" />
            <div className="grid grid-cols-2 gap-3 mt-4">
              {(["YES","NO"] as const).map((s) => (
                <div key={s} className={cn("rounded-lg p-3 border", s === "YES" ? "bg-cyan/5 border-cyan/15" : "bg-pink/5 border-pink/15")}>
                  <div className={cn("text-xs font-bold mb-1", s === "YES" ? "text-cyan" : "text-pink")}>{s}</div>
                  <div className={cn("text-2xl font-bold tabular-nums", s === "YES" ? "text-cyan" : "text-pink")}>
                    {fmtProb(s === "YES" ? market.yesProb : market.noProb)}
                  </div>
                  <div className="text-xs text-secondary mt-0.5">
                    Pool: {fmtUSDM(s === "YES" ? market.yesPool : market.noPool)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Volume"   value={fmtUSDMCompact(market.volume)}    icon={<TrendingUp size={14} />} />
            <StatCard label="Pool"     value={fmtUSDM(market.totalPool)}         icon={<Users size={14} />} />
            <StatCard label={status === "open" ? "Time Left" : "Ended"} value={status === "open" ? fmtTimeLeft(market.timeLeft) : fmtEndDate(market.endTime)} icon={<Clock size={14} />} />
            <StatCard label="Currency" value="USDM" />
          </div>

          {market.description && (
            <div className="glass rounded-xl p-5">
              <h3 className="text-sm font-semibold text-secondary mb-2">Resolution Criteria</h3>
              <p className="text-sm text-primary/80 leading-relaxed">{market.description}</p>
            </div>
          )}

          {/* User position */}
          {hasPos && (
            <div className="glass-cyan rounded-xl p-5">
              <h3 className="text-sm font-semibold text-cyan mb-3 flex items-center gap-2"><CheckCircle size={14} />Your Position</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {position.yesShares > 0n && (
                  <div>
                    <div className="text-secondary text-xs mb-0.5">YES Shares</div>
                    <div className="font-mono font-bold text-cyan">{fmtUSDM(position.yesShares)}</div>
                    <div className="text-xs text-secondary mt-0.5">Est. payout: {fmtUSDM(position.estimatedYesPayout)}</div>
                  </div>
                )}
                {position.noShares > 0n && (
                  <div>
                    <div className="text-secondary text-xs mb-0.5">NO Shares</div>
                    <div className="font-mono font-bold text-pink">{fmtUSDM(position.noShares)}</div>
                    <div className="text-xs text-secondary mt-0.5">Est. payout: {fmtUSDM(position.estimatedNoPayout)}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Contract info */}
          <div className="glass rounded-xl p-4 space-y-2">
            <h3 className="text-xs font-semibold text-secondary uppercase tracking-wide mb-3">Contract Info</h3>
            <InfoRow label="Market"   value={shortenAddress(market.address)} link={addrUrl(market.address)} copy={market.address} />
            <InfoRow label="Creator"  value={shortenAddress(market.creator)} link={addrUrl(market.creator)} />
            <InfoRow label="Currency" value="USDM (stablecoin)" />
            <InfoRow label="End Date" value={fmtEndDate(market.endTime)} />
          </div>
        </div>

        {/* Right: trading panel */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-24">
            <BuySharesPanel market={market} position={position} onSuccess={() => { refetch(); refetchPosition(); }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status, outcome }: { status: string; outcome: boolean }) {
  const map: Record<string, string> = {
    open:      "text-cyan bg-cyan/10 border-cyan/20",
    expired:   "text-secondary bg-surface-2 border-border",
    resolved:  outcome ? "text-cyan bg-cyan/10 border-cyan/20" : "text-pink bg-pink/10 border-pink/20",
    cancelled: "text-secondary bg-surface-2 border-border",
  };
  const labels: Record<string, string> = {
    open: "● LIVE", expired: "ENDED",
    resolved: `RESOLVED · ${outcome ? "YES" : "NO"}`, cancelled: "CANCELLED",
  };
  return <span className={cn("text-xs font-bold px-2.5 py-1 rounded-full border", map[status])}>{labels[status]}</span>;
}

function StatCard({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="glass rounded-lg p-3">
      <div className="flex items-center gap-1.5 text-xs text-secondary mb-1">{icon}{label}</div>
      <div className="text-sm font-bold text-primary">{value}</div>
    </div>
  );
}

function InfoRow({ label, value, link, copy }: { label: string; value: string; link?: string; copy?: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-secondary">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-primary">{value}</span>
        {link && <a href={link} target="_blank" rel="noreferrer" className="text-cyan/50 hover:text-cyan"><ExternalLink size={11} /></a>}
        {copy && <button onClick={() => { navigator.clipboard.writeText(copy); toast.success("Copied!"); }} className="text-secondary/50 hover:text-secondary"><Copy size={11} /></button>}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 animate-pulse">
      <div className="h-4 bg-surface-2 rounded w-24 mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="h-48 bg-surface-2 rounded-xl" />
          <div className="h-8 bg-surface-2 rounded w-3/4" />
          <div className="h-32 bg-surface-2 rounded-xl" />
        </div>
        <div className="h-64 bg-surface-2 rounded-xl" />
      </div>
    </div>
  );
}
