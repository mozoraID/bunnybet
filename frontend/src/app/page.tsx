"use client";

import { useState, useMemo } from "react";
import Link                  from "next/link";
import { useMarkets, useMarketCount } from "@/hooks/useMarkets";
import { MarketCard, MarketCardSkeleton } from "@/components/markets/MarketCard";
import { CategoryFilter }               from "@/components/markets/CategoryFilter";
import { usePrices }                    from "@/hooks/usePrices";
import { type Category, type Market }   from "@/types/market";
import { fmtUSDMCompact }               from "@/lib/utils";

const TICKER_SYMS = ["BTC", "ETH", "SOL", "ARB", "LINK", "DOGE"];
type Sort = "volume" | "newest" | "ending";

function PriceBar() {
  const { data } = usePrices();
  if (!data) return null;
  return (
    <div className="border-b border-border-dark bg-ink-2 py-1.5 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-5 overflow-x-auto no-scrollbar font-mono text-xs text-dim-2">
          <span className="shrink-0 tracking-widest text-[10px]">PRICES</span>
          {TICKER_SYMS.map((sym) => {
            const p = data.prices[sym];
            if (!p) return null;
            const up = p.change24h >= 0;
            return (
              <span key={sym} className="shrink-0 flex items-center gap-1.5">
                <span>{sym}</span>
                <span className="text-off-white">${p.price.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
                <span className={up ? "text-off-white/50" : "text-dim-2/70"}>
                  {up ? "▲" : "▼"}{Math.abs(p.change24h).toFixed(1)}%
                </span>
              </span>
            );
          })}
          <span className="ml-auto shrink-0 text-[10px] text-dim-2/50">VIA CHAINLINK</span>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [category, setCategory] = useState<Category>("All");
  const [search,   setSearch]   = useState("");
  const [sort,     setSort]     = useState<Sort>("volume");

  const { markets, isLoading, isFetching, refetch } = useMarkets(40);
  const { data: totalCount } = useMarketCount();

  const filtered = useMemo<Market[]>(() => {
    let list = [...markets];
    if (category !== "All") list = list.filter((m) => m.category === category);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((m) => m.question.toLowerCase().includes(q) || m.description.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      if (sort === "volume") return b.volume > a.volume ? 1 : -1;
      if (sort === "newest") return b.createdAt - a.createdAt;
      if (sort === "ending") return (a.timeLeft || 9e9) - (b.timeLeft || 9e9);
      return 0;
    });
    return list;
  }, [markets, category, search, sort]);

  const stats = useMemo(() => ({
    vol:  markets.reduce((a, m) => a + m.volume, 0n),
    open: markets.filter((m) => !m.resolved && !m.cancelled && m.timeLeft > 0).length,
  }), [markets]);

  return (
    <>
      <PriceBar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 md:pb-8">

        {/* ── MegaETH-style hero ────────────────────────────────── */}
        <div className="border-b border-border-dark">
          <div className="py-12 sm:py-16">
            {/* Big headline */}
            <h1 className="font-sans font-black uppercase text-off-white mb-2"
              style={{ fontSize: "clamp(2.2rem, 5vw, 4.5rem)", lineHeight: "0.95", letterSpacing: "-0.02em" }}>
              PREDICTION<br />MARKETS
            </h1>
            <p className="font-mono text-sm text-dim-2 max-w-lg mb-8">
              TRADE REAL-WORLD OUTCOMES WITH USDM STABLECOIN.
              SETTLED INSTANTLY ON MEGAETH. 100K+ TPS.
            </p>

            {/* Terminal stat boxes — exactly like megaeth.com */}
            <div className="flex flex-wrap gap-3">
              <StatBox value={totalCount?.toString() ?? markets.length.toString()} label="TOTAL MARKETS" />
              <StatBox value={String(stats.open)} label="OPEN NOW" highlight />
              <StatBox value={fmtUSDMCompact(stats.vol)} label="TOTAL VOLUME" />
              <StatBox value=">100K" label="TPS MEGAETH" />
              <StatBox value="<10MS" label="BLOCK TIME" />
            </div>
          </div>
        </div>

        {/* ── Filters ───────────────────────────────────────────── */}
        <div className="py-5 border-b border-border-dark flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <input type="text" placeholder="SEARCH MARKETS..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-ink-3 border border-border-dark px-4 py-2 font-mono text-xs text-off-white placeholder-dim-2 tracking-widest focus:border-off-white/30 transition-colors"
            />
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1 border border-border-dark p-0.5">
            {(["volume", "newest", "ending"] as Sort[]).map((s) => (
              <button key={s} onClick={() => setSort(s)}
                className={cn("px-3 py-1.5 font-mono text-[10px] tracking-widest transition-all",
                  sort === s ? "bg-off-white text-ink font-bold" : "text-dim-2 hover:text-off-white")}>
                {s === "ending" ? "ENDING" : s.toUpperCase()}
              </button>
            ))}
          </div>

          <button onClick={() => refetch()}
            className="font-mono text-[10px] text-dim-2 hover:text-off-white tracking-widest ml-auto">
            {isFetching ? "UPDATING..." : "↻ REFRESH"}
          </button>

          <Link href="/create"
            className="px-4 py-2 bg-off-white text-ink font-mono text-xs font-bold tracking-widest hover:bg-cream transition-all">
            + NEW MARKET
          </Link>
        </div>

        {/* Categories */}
        <div className="py-4 border-b border-border-dark">
          <CategoryFilter selected={category} onChange={setCategory} />
        </div>

        {/* ── Market grid ───────────────────────────────────────── */}
        <div className="py-6">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 9 }).map((_, i) => <MarketCardSkeleton key={i} index={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <Empty search={search} category={category} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((m, i) => <MarketCard key={m.address} market={m} index={i} />)}
            </div>
          )}
        </div>

      </div>
    </>
  );
}

function StatBox({ value, label, highlight }: { value: string; label: string; highlight?: boolean }) {
  return (
    <div className="terminal-box px-4 py-3 min-w-[120px]">
      <div className={`text-2xl font-mono font-bold ${highlight ? "text-off-white" : "text-off-white/80"}`}>
        {value}
      </div>
      <div className="font-mono text-[10px] text-dim-2 tracking-widest mt-0.5">{label}</div>
    </div>
  );
}

function Empty({ search, category }: { search: string; category: Category }) {
  return (
    <div className="text-center py-24 border border-border-dark">
      <div className="font-mono text-dim-2 text-xs tracking-widest mb-4">NO MARKETS FOUND</div>
      <p className="font-mono text-xs text-dim-2 mb-6">
        {search ? `NO RESULTS FOR "${search.toUpperCase()}"` : `NO ${category.toUpperCase()} MARKETS YET.`}
      </p>
      <Link href="/create" className="inline-block px-4 py-2 bg-off-white text-ink font-mono text-xs font-bold tracking-widest hover:bg-cream">
        + CREATE FIRST MARKET
      </Link>
    </div>
  );
}

import { cn } from "@/lib/utils";
