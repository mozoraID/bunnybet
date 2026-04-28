"use client";
import { useState, useMemo } from "react";
import { Zap, TrendingUp, Search, RefreshCw } from "lucide-react";
import { useMarkets, useMarketCount }    from "@/hooks/useMarkets";
import { MarketCard, MarketCardSkeleton } from "@/components/markets/MarketCard";
import { CategoryFilter }                from "@/components/markets/CategoryFilter";
import { type Category, type Market }    from "@/types/market";
import { fmtUSDMCompact, cn }            from "@/lib/utils";

export default function HomePage() {
  const [category, setCategory] = useState<Category>("All");
  const [search,   setSearch]   = useState("");
  const { markets, isLoading, isFetching, refetch } = useMarkets(30);
  const { data: totalCount } = useMarketCount();

  const filtered = useMemo<Market[]>(() => {
    let list = markets;
    if (category !== "All") list = list.filter((m) => m.category === category);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((m) => m.question.toLowerCase().includes(q) || m.description.toLowerCase().includes(q));
    }
    return list;
  }, [markets, category, search]);

  const stats = useMemo(() => ({
    totalVol:  markets.reduce((a, m) => a + m.volume, 0n),
    openCount: markets.filter((m) => !m.resolved && !m.cancelled && m.timeLeft > 0).length,
  }), [markets]);

  const featured = [...filtered].sort((a, b) => b.volume > a.volume ? 1 : -1).slice(0, 3);
  const rest     = filtered.slice(3);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Zap size={16} className="text-cyan animate-pulse" />
          <span className="text-xs font-mono text-cyan/70 uppercase tracking-widest">Live on MegaETH · USDM</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">
          <span className="gradient-text">Trending Markets</span>
        </h1>
        <p className="text-secondary text-sm">Trade with <span className="text-cyan font-bold">USDM stablecoin</span>. No price risk from the currency itself.</p>

        <div className="flex flex-wrap items-center gap-4 mt-4">
          {[
            { label: "Total Markets", value: (totalCount?.toString() ?? markets.length.toString()), icon: <TrendingUp size={13} className="text-cyan" /> },
            { label: "Open",   value: String(stats.openCount), highlight: true },
            { label: "Volume", value: fmtUSDMCompact(stats.totalVol) },
          ].map(({ label, value, icon, highlight }) => (
            <div key={label} className="glass rounded-lg px-4 py-2 flex items-center gap-2">
              {icon}
              <span className="text-xs text-secondary">{label}</span>
              <span className={cn("text-sm font-bold tabular-nums", highlight ? "text-cyan" : "text-primary")}>{value}</span>
            </div>
          ))}
          <button onClick={() => refetch()} className="ml-auto flex items-center gap-1.5 text-xs text-secondary hover:text-cyan transition-colors">
            <RefreshCw size={11} className={cn(isFetching && "animate-spin")} />
            {isFetching ? "Updating..." : "Live"}
          </button>
        </div>
      </div>

      {/* Search + filter */}
      <div className="mb-6 space-y-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary" />
          <input type="text" placeholder="Search markets..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 glass border border-border rounded-lg text-sm text-primary placeholder-tertiary" />
        </div>
        <CategoryFilter selected={category} onChange={setCategory} />
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => <MarketCardSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">🐰</div>
          <h3 className="text-lg font-semibold mb-2">No markets found</h3>
          <a href="/create" className="inline-block mt-4 px-4 py-2 rounded-lg bg-cyan/10 text-cyan border border-cyan/20 text-sm">Create the first market →</a>
        </div>
      ) : (
        <>
          {featured.length > 0 && !search && category === "All" && (
            <section className="mb-8">
              <Divider label="🔥 Top Markets" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {featured.map((m, i) => <MarketCard key={m.address} market={m} featured index={i} />)}
              </div>
            </section>
          )}
          {(rest.length > 0 || search || category !== "All") && (
            <section>
              {!search && category === "All" && rest.length > 0 && <Divider label="All Markets" />}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(search || category !== "All" ? filtered : rest).map((m, i) => <MarketCard key={m.address} market={m} index={i} />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
      <span className="text-xs font-bold text-secondary uppercase tracking-widest px-2">{label}</span>
      <div className="h-px flex-1 bg-gradient-to-l from-border to-transparent" />
    </div>
  );
}
