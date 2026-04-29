"use client";

import Link            from "next/link";
import { useAccount, useWriteContract } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import toast             from "react-hot-toast";
import { usePortfolio, type PortfolioEntry } from "@/hooks/useMarket";
import { ProbabilityBar } from "@/components/markets/ProbabilityBar";
import { getMarketStatus }  from "@/types/market";
import { MARKET_ABI }       from "@/lib/contracts";
import { fmtUSDM, fmtUSDMCompact, fmtTimeLeft, shortenAddress, cn } from "@/lib/utils";

export default function PortfolioPage() {
  const { address, isConnected } = useAccount();
  const { data: entries = [], isLoading, refetch } = usePortfolio();

  if (!isConnected) return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
      <p className="font-mono text-xs text-dim-2 tracking-widest">CONNECT WALLET</p>
      <ConnectButton />
    </div>
  );

  if (isLoading) return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-3">
      {Array.from({length:3}).map((_,i)=><div key={i} className="h-32 shimmer"/>)}
    </div>
  );

  const claimable = entries.filter((e) => {
    const s = getMarketStatus(e.market);
    if (s==="resolved") return ((e.market.outcome && e.position.yesShares > 0n) || (!e.market.outcome && e.position.noShares > 0n)) && !e.position.hasRedeemed;
    if (s==="cancelled") return (e.position.yesShares > 0n || e.position.noShares > 0n) && !e.position.hasClaimedRefund;
    return false;
  });
  const open = entries.filter((e) => getMarketStatus(e.market) === "open");
  const past = entries.filter((e) => ["resolved","expired","cancelled"].includes(getMarketStatus(e.market)));

  const totalStaked = entries.reduce((a,e) => a + e.position.yesShares + e.position.noShares, 0n);
  const totalValue  = entries.reduce((a,e) => {
    const est = e.position.yesShares > 0n ? e.position.estimatedYesPayout : e.position.noShares > 0n ? e.position.estimatedNoPayout : 0n;
    return a + est;
  }, 0n);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 pb-24 md:pb-8 space-y-8">
      <div className="border-b border-border-dark pb-6">
        <h1 className="font-sans font-black text-off-white uppercase mb-1"
          style={{ fontSize: "clamp(1.8rem, 4vw, 3rem)", lineHeight: "0.95", letterSpacing: "-0.02em" }}>
          PORTFOLIO
        </h1>
        <p className="font-mono text-xs text-dim-2">{shortenAddress(address ?? "")}</p>
      </div>

      {/* Stats — terminal style */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "ACTIVE",    value: String(open.length) },
          { label: "CLAIMABLE", value: String(claimable.length), hi: claimable.length > 0 },
          { label: "STAKED",    value: fmtUSDMCompact(totalStaked) },
          { label: "EST VALUE", value: fmtUSDMCompact(totalValue) },
        ].map(({ label, value, hi }) => (
          <div key={label} className="terminal-box p-3">
            <div className="font-mono text-[10px] text-dim-2 tracking-widest mb-1">{label}</div>
            <div className={cn("font-mono text-xl font-bold", hi ? "text-off-white" : "text-off-white/70")}>{value}</div>
          </div>
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="terminal-box p-8 text-center">
          <p className="font-mono text-xs text-dim-2 tracking-widest mb-4">NO POSITIONS</p>
          <Link href="/" className="font-mono text-xs text-off-white underline">BROWSE MARKETS →</Link>
        </div>
      ) : (
        <>
          {claimable.length > 0 && <Section title="READY TO CLAIM">{claimable.map(e=><Row key={e.market.address} entry={e} onSuccess={refetch}/>)}</Section>}
          {open.length      > 0 && <Section title="ACTIVE">{open.map(e=><Row key={e.market.address} entry={e} onSuccess={refetch}/>)}</Section>}
          {past.length      > 0 && <Section title="HISTORY">{past.map(e=><Row key={e.market.address} entry={e} onSuccess={refetch}/>)}</Section>}
        </>
      )}
    </div>
  );
}

function Row({ entry: { market, position }, onSuccess }: { entry: PortfolioEntry; onSuccess: () => void }) {
  const status = getMarketStatus(market);
  const { writeContract, isPending } = useWriteContract();
  const won = status==="resolved" && ((market.outcome && position.yesShares > 0n) || (!market.outcome && position.noShares > 0n));
  const claimable  = won && !position.hasRedeemed;
  const refundable = status==="cancelled" && (position.yesShares > 0n || position.noShares > 0n) && !position.hasClaimedRefund;

  function doWrite(fn: "redeem" | "claimRefund") {
    writeContract(
      { address: market.address, abi: MARKET_ABI, functionName: fn },
      { onSuccess: () => { toast.success("DONE"); onSuccess(); }, onError: (e) => toast.error(e.message.slice(0,80)) }
    );
  }

  return (
    <Link href={`/markets/${market.address}`} className="block card-dark p-4 hover:bg-ink-3 transition-all group"
      onClick={(e) => { if ((e.target as HTMLElement).tagName==="BUTTON") e.preventDefault(); }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-sans font-black text-off-white uppercase text-sm leading-tight line-clamp-2 mb-2 group-hover:text-off-white/80 transition-colors" style={{ letterSpacing: "-0.01em" }}>
            {market.question}
          </h3>
          <div className="flex flex-wrap gap-1.5 font-mono text-xs">
            {position.yesShares > 0n && <span className="px-1.5 py-0.5 border border-off-white/20 text-off-white">YES {fmtUSDM(position.yesShares)}</span>}
            {position.noShares  > 0n && <span className="px-1.5 py-0.5 border border-border-dark text-dim-2">NO {fmtUSDM(position.noShares)}</span>}
            {position.hasRedeemed && <span className="text-dim-2">✓ CLAIMED</span>}
          </div>
        </div>
        <div className="shrink-0">
          {claimable  && <button onClick={(e)=>{e.stopPropagation();e.preventDefault();doWrite("redeem");}} disabled={isPending} className="px-3 py-1.5 bg-off-white text-ink font-mono text-xs font-bold tracking-widest hover:bg-cream disabled:opacity-50">{isPending?"...":"CLAIM"}</button>}
          {refundable && <button onClick={(e)=>{e.stopPropagation();e.preventDefault();doWrite("claimRefund");}} disabled={isPending} className="px-3 py-1.5 border border-border-dark text-dim-2 font-mono text-xs hover:text-off-white disabled:opacity-50">{isPending?"...":"REFUND"}</button>}
        </div>
      </div>
      <ProbabilityBar yesProb={market.yesProb} noProb={market.noProb} size="xs" showLabels={false} dark />
      <div className="flex items-center justify-between mt-2 font-mono text-[10px] text-dim-2">
        <span className={cn(status==="resolved" ? (won ? "text-off-white" : "text-dim-2") : "")}>
          {status==="open" ? fmtTimeLeft(market.timeLeft)+" LEFT" : status==="resolved" ? (won ? "✓ WON" : "✗ LOST") : status.toUpperCase()}
        </span>
        <span>{fmtUSDMCompact(market.volume)} VOL</span>
      </div>
    </Link>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-mono text-[10px] text-dim-2 tracking-widest mb-2 border-b border-border-dark pb-2">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
