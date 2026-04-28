"use client";
import Link from "next/link";
import { useAccount, useWriteContract } from "wagmi";
import { ConnectButton }   from "@rainbow-me/rainbowkit";
import toast               from "react-hot-toast";
import { TrendingUp, Clock, CheckCircle, XCircle, Coins, DollarSign } from "lucide-react";
import { usePortfolio, type PortfolioEntry } from "@/hooks/useMarket";
import { ProbabilityBar } from "@/components/markets/ProbabilityBar";
import { getMarketStatus } from "@/types/market";
import { fmtUSDM, fmtUSDMCompact, fmtTimeLeft, shortenAddress, cn, txUrl } from "@/lib/utils";
import { MARKET_ABI }      from "@/lib/contracts";

export default function PortfolioPage() {
  const { address, isConnected } = useAccount();
  const { data: entries = [], isLoading, refetch } = usePortfolio();

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="text-5xl">🐰</div>
        <h2 className="text-xl font-semibold">Connect to view your portfolio</h2>
        <p className="text-secondary text-sm">See your USDM positions and claim winnings.</p>
        <div className="flex justify-center"><ConnectButton /></div>
      </div>
    );
  }

  if (isLoading) return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
      {Array.from({ length: 3 }).map((_, i) => <div key={i} className="glass rounded-xl h-32 animate-pulse" />)}
    </div>
  );

  const claimable = entries.filter((e) => {
    const s = getMarketStatus(e.market);
    if (s === "resolved") {
      const won = (e.market.outcome && e.position.yesShares > 0n) || (!e.market.outcome && e.position.noShares > 0n);
      return won && !e.position.hasRedeemed;
    }
    if (s === "cancelled") return (e.position.yesShares > 0n || e.position.noShares > 0n) && !e.position.hasClaimedRefund;
    return false;
  });
  const open = entries.filter((e) => getMarketStatus(e.market) === "open");
  const past = entries.filter((e) => ["resolved","expired","cancelled"].includes(getMarketStatus(e.market)));

  const totalValue = entries.reduce((a, e) => {
    const est = e.position.yesShares > 0n ? e.position.estimatedYesPayout :
                e.position.noShares  > 0n ? e.position.estimatedNoPayout  : 0n;
    return a + est;
  }, 0n);

  const totalStaked = entries.reduce((a, e) => a + e.position.yesShares + e.position.noShares, 0n);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 pb-24 md:pb-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold gradient-text mb-1">My Portfolio</h1>
        <p className="text-secondary text-sm font-mono">{shortenAddress(address ?? "")}</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Active"     value={String(open.length)}              icon={<TrendingUp size={14} className="text-cyan" />} />
        <SummaryCard label="Claimable"  value={String(claimable.length)}         icon={<CheckCircle size={14} className="text-green-400" />} highlight={claimable.length > 0} />
        <SummaryCard label="Staked"     value={fmtUSDMCompact(totalStaked)}      icon={<DollarSign size={14} className="text-cyan" />} />
        <SummaryCard label="Est. Value" value={fmtUSDMCompact(totalValue)}       icon={<Coins size={14} className="text-purple" />} />
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">🐰</div>
          <h3 className="text-lg font-semibold mb-2">No positions yet</h3>
          <Link href="/" className="inline-block px-4 py-2 rounded-lg bg-cyan/10 text-cyan border border-cyan/20 text-sm">Browse Markets →</Link>
        </div>
      ) : (
        <>
          {claimable.length > 0 && <Section title="🎉 Ready to Claim">{claimable.map((e) => <PositionRow key={e.market.address} entry={e} onSuccess={refetch} />)}</Section>}
          {open.length  > 0 && <Section title="⚡ Active Positions">{open.map((e) => <PositionRow key={e.market.address} entry={e} onSuccess={refetch} />)}</Section>}
          {past.length  > 0 && <Section title="History">{past.map((e) => <PositionRow key={e.market.address} entry={e} onSuccess={refetch} />)}</Section>}
        </>
      )}
    </div>
  );
}

function PositionRow({ entry, onSuccess }: { entry: PortfolioEntry; onSuccess: () => void }) {
  const { market, position } = entry;
  const status = getMarketStatus(market);
  const { writeContract, isPending } = useWriteContract();

  const won      = status === "resolved" && ((market.outcome && position.yesShares > 0n) || (!market.outcome && position.noShares > 0n));
  const claimable = won && !position.hasRedeemed;
  const refundable = status === "cancelled" && (position.yesShares > 0n || position.noShares > 0n) && !position.hasClaimedRefund;

  function doWrite(fn: string) {
    writeContract({ address: market.address, abi: MARKET_ABI, functionName: fn as any },
      { onSuccess: () => { toast.success(fn === "redeem" ? "Claimed! 🎉" : "Refunded!"); onSuccess(); },
        onError: (e) => toast.error(e.message.slice(0, 80)) });
  }

  return (
    <Link href={`/markets/${market.address}`} className="block glass rounded-xl p-4 hover:border-glow transition-all group"
      onClick={(e) => { if ((e.target as HTMLElement).tagName === "BUTTON") e.preventDefault(); }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-primary group-hover:text-white line-clamp-2 mb-1">{market.question}</h3>
          <div className="flex items-center gap-2 flex-wrap">
            {position.yesShares > 0n && <span className="text-xs font-bold text-cyan bg-cyan/10 px-2 py-0.5 rounded">YES {fmtUSDM(position.yesShares)}</span>}
            {position.noShares  > 0n && <span className="text-xs font-bold text-pink bg-pink/10 px-2 py-0.5 rounded">NO {fmtUSDM(position.noShares)}</span>}
            {position.hasRedeemed && <span className="text-xs text-secondary">✓ Redeemed</span>}
          </div>
        </div>
        <div className="shrink-0">
          {claimable  && <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); doWrite("redeem"); }} disabled={isPending} className="px-3 py-1.5 bg-cyan text-background text-xs font-bold rounded-lg shadow-cyan-glow disabled:opacity-50">{isPending ? "..." : "Claim"}</button>}
          {refundable && <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); doWrite("claimRefund"); }} disabled={isPending} className="px-3 py-1.5 border border-border text-secondary text-xs font-bold rounded-lg">{isPending ? "..." : "Refund"}</button>}
          {status === "resolved" && !won && <XCircle size={16} className="text-pink/50" />}
        </div>
      </div>
      <ProbabilityBar yesProb={market.yesProb} noProb={market.noProb} size="sm" />
      <div className="flex items-center justify-between mt-2 text-xs text-secondary">
        <span>{status === "open" ? <span className="flex items-center gap-1"><Clock size={11} />{fmtTimeLeft(market.timeLeft)} left</span>
          : <span className={cn("font-medium", status === "resolved" ? (won ? "text-cyan" : "text-pink") : "")}>
              {status === "resolved" ? (won ? "✓ Won" : "✗ Lost") : status}
            </span>}</span>
        <span>Vol: {fmtUSDMCompact(market.volume)}</span>
      </div>
    </Link>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><h2 className="text-sm font-semibold text-secondary mb-3">{title}</h2><div className="space-y-3">{children}</div></div>;
}

function SummaryCard({ label, value, icon, highlight }: { label: string; value: string; icon?: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={cn("glass rounded-xl p-4", highlight ? "glass-cyan" : "")}>
      <div className="flex items-center gap-1.5 text-xs text-secondary mb-1">{icon}{label}</div>
      <div className={cn("text-xl font-bold tabular-nums", highlight ? "text-cyan" : "text-primary")}>{value}</div>
    </div>
  );
}
