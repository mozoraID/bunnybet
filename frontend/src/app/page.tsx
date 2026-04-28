"use client";

import { useState, useMemo } from "react";
import Link                  from "next/link";
import {
  Search, RefreshCw, TrendingUp, Activity, Zap, Plus,
} from "lucide-react";
import { useMarkets, useMarketCount } from "@/hooks/useMarkets";
import { MarketCard, MarketCardSkeleton } from "@/components/markets/MarketCard";
import { CategoryFilter }               from "@/components/markets/CategoryFilter";
import { usePrices }                    from "@/hooks/usePrices";
import { type Category, type Market }   from "@/types/market";
import { fmtUSDMCompact, cn }           from "@/lib/utils";

// ── Price ticker bar ──────────────────────────────────────────────
const TICKER_SYMBOLS = ["BTC", "ETH", "SOL", "ARB", "OP", "LINK"];

function PriceTicker() {
  const { data, isLoading } = usePrices();
  if (isLoading || !data) return null;

  return (
    <div className="border-b border-border bg-bg-3/60 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6 py-2 overflow-x-auto no-scrollbar text-xs font-mono">
          <span className="text-secondary shrink-0 flex items-center gap-1 text-[10px] uppercase tracking-wider">
            <Activity size={10} />
            Live prices
          </span>
          {TICKER_SYMBOLS.map((sym) => {
            const p = data.prices[sym];
            if (!p) return null;
            const up = p.change24h >= 0;
            return (
              <div key={sym} className="flex items-center gap-2 shrink-0">
                <span className="text-secondary">{sym}</span>
                <span className="text-white font-semibold">
                  ${p.price.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </span>
                <span className={up ? "text-green" : "text-red"}>
                  {up ? "▲" : "▼"} {Math.abs(p.change24h).toFixed(2)}%
                </span>
              </div>
            );
          })}
          <span className="ml-auto shrink-0 text-tertiary text-[10px]">via Chainlink</span>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────
type SortKey = "volume" | "newest" | "ending";

export default function HomePage() {
  const [category, setCategory] = useState<Category>("All");
  const [search,   setSearch]   = useState("");
  const [sort,     setSort]     = useState<SortKey>("volume");

  const { markets, isLoading, isFetching, refetch } = useMarkets(40);
  const { data: totalCount } = useMarketCount();

  const filtered = useMemo<Market[]>(() => {
    let list = [...markets];

    if (category !== "All")
      list = list.filter((m) => m.category === category);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) => m.question.toLowerCase().includes(q)
            || m.description.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      if (sort === "volume")  return b.volume > a.volume ? 1 : -1;
      if (sort === "newest")  return b.createdAt - a.createdAt;
      if (sort === "ending")  return (a.timeLeft || 9e9) - (b.timeLeft || 9e9);
      return 0;
    });

    return list;
  }, [markets, category, search, sort]);

  const stats = useMemo(() => ({
    totalVol:  markets.reduce((a, m) => a + m.volume, 0n),
    openCount: markets.filter((m) => !m.resolved && !m.cancelled && m.timeLeft > 0).length,
  }), [markets]);

  return (
    <>
      <PriceTicker />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28 md:pb-8">

        {/* ── Hero ───────────────────────────────────────────────── */}
        <div className="mb-8 rounded-2xl border border-green/12 bg-gradient-to-br from-green/5 via-transparent to-transparent p-6 relative overflow-hidden">
          {/* Background glow */}
          <div className="absolute -top-20 -right-20 w-72 h-72 bg-green/6 rounded-full blur-3xl pointer-events-none" />

          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <span className="live-dot text-xs font-mono text-green/80 uppercase tracking-widest">
                Live on MegaETH
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
              Prediction Markets
            </h1>
            <p className="text-secondary text-sm max-w-xl">
              Trade on real-world outcomes using{" "}
              <span className="text-green font-semibold">USDM stablecoin</span>.
              No price volatility. Instant settlement on MegaETH.
            </p>

            {/* Stats row */}
            <div className="flex flex-wrap items-center gap-3 mt-5">
              <Chip icon={<Activity size={12} />} label="Markets" value={totalCount?.toString() ?? markets.length.toString()} />
              <Chip icon={<Zap size={12} />}      label="Open"    value={String(stats.openCount)} accent />
              <Chip                               label="Volume"  value={fmtUSDMCompact(stats.totalVol)} />

              <button
                onClick={() => refetch()}
                className="ml-auto flex items-center gap-1.5 text-xs text-secondary hover:text-white transition-colors"
              >
                <RefreshCw size={11} className={cn(isFetching && "animate-spin")} />
                {isFetching ? "Updating…" : "Refresh"}
              </button>

              <Link
                href="/create"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green text-bg text-sm font-bold hover:brightness-110 transition-all shadow-green-sm"
              >
                <Plus size={14} />
                New Market
              </Link>
            </div>
          </div>
        </div>

        {/* ── Filters ────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary" />
            <input
              type="text"
              placeholder="Search markets…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-bg-3 border border-border rounded-lg text-sm text-white placeholder-tertiary focus:border-green/35 transition-colors"
            />
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1 bg-bg-3 border border-border rounded-lg p-1">
            {(["volume", "newest", "ending"] as SortKey[]).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all",
                  sort === s
                    ? "bg-white/10 text-white"
                    : "text-secondary hover:text-white"
                )}
              >
                {s === "ending" ? "Ending soon" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Category pills */}
        <CategoryFilter
          selected={category}
          onChange={setCategory}
          className="mb-6"
        />

        {/* ── Market grid ────────────────────────────────────────── */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <MarketCardSkeleton key={i} index={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Empty search={search} category={category} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((m, i) => (
              <MarketCard key={m.address} market={m} index={i} />
            ))}
          </div>
        )}

      </div>
    </>
  );
}

function Chip({
  icon, label, value, accent,
}: { icon?: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 bg-bg-3 border border-border rounded-lg px-3 py-1.5 text-sm">
      {icon && <span className="text-secondary">{icon}</span>}
      <span className="text-secondary text-xs">{label}</span>
      <span className={cn("font-bold tabular-nums", accent ? "text-green" : "text-white")}>
        {value}
      </span>
    </div>
  );
}

function Empty({ search, category }: { search: string; category: Category }) {
  return (
    <div className="text-center py-24">
      <div className="text-5xl mb-4">🐰</div>
      <h3 className="text-lg font-semibold mb-2">No markets found</h3>
      <p className="text-secondary text-sm mb-6">
        {search
          ? `No results for "${search}"`
          : category !== "All"
            ? `No ${category} markets yet.`
            : "No markets created yet."}
      </p>
      <Link
        href="/create"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green text-bg text-sm font-bold hover:brightness-110 transition-all"
      >
        <Plus size={14} /> Create First Market
      </Link>
    </div>
  );
}
