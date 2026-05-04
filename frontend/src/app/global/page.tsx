"use client";

import { useState, useEffect, useCallback } from "react";
import { ExternalLink, RefreshCw, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface PolyMarket {
  id: string;
  question: string;
  description: string;
  image: string;
  endDate: string;
  volume: number;
  volume24h: number;
  category: string;
  outcomes: string[];
  outcomePrices: number[];
  polymarketUrl: string;
}

const CATEGORIES = ["ALL", "CRYPTO", "POLITICS", "SPORTS", "TECH", "FINANCE", "ENTERTAINMENT"];

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function timeLeft(endDate: string): string {
  if (!endDate) return "";
  const diff = new Date(endDate).getTime() - Date.now();
  if (diff <= 0) return "ENDED";
  const days = Math.floor(diff / 86_400_000);
  if (days > 30) return `${Math.floor(days / 30)} MONTHS`;
  if (days > 0)  return `${days} DAYS`;
  const hrs = Math.floor(diff / 3_600_000);
  return `${hrs} HRS`;
}

function MarketCard({ m }: { m: PolyMarket }) {
  const yes = m.outcomePrices[0] ?? 50;
  const no  = m.outcomePrices[1] ?? (100 - yes);

  return (
    <a href={m.polymarketUrl} target="_blank" rel="noreferrer"
      className="block bg-cream border border-border-light hover:border-ink/30 transition-all cursor-pointer group">
      {m.image && (
        <div className="h-28 overflow-hidden border-b border-border-light">
          <img src={m.image} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        </div>
      )}
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <span className="font-mono text-[9px] text-dim-light tracking-widest">{m.category}</span>
          <ExternalLink size={10} className="text-dim-light shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        <p className="font-sans font-bold text-sm text-ink leading-snug line-clamp-2">
          {m.question}
        </p>

        {/* Odds bar */}
        <div>
          <div className="flex justify-between font-mono text-xs font-bold text-ink mb-1.5">
            <span>YES {yes}%</span>
            <span>NO {no}%</span>
          </div>
          <div className="h-1.5 bg-ink/10 overflow-hidden">
            <div className="h-full bg-ink transition-all" style={{ width: `${yes}%` }} />
          </div>
        </div>

        <div className="flex justify-between items-center font-mono text-[10px] text-dim-light pt-1">
          <span>VOL {formatVolume(m.volume)}</span>
          <span className="flex items-center gap-1">
            <TrendingUp size={9} />
            {formatVolume(m.volume24h)} 24H
          </span>
          <span>{timeLeft(m.endDate)}</span>
        </div>
      </div>
    </a>
  );
}

export default function GlobalMarketsPage() {
  const [markets,    setMarkets]    = useState<PolyMarket[]>([]);
  const [isLoading,  setIsLoading]  = useState(true);
  const [category,   setCategory]   = useState("ALL");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const load = useCallback(async (cat: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ limit: "30" });
      if (cat !== "ALL") params.set("category", cat.toLowerCase());
      const res = await fetch(`/api/polymarket-markets?${params}`);
      const data = await res.json();
      setMarkets(data.markets ?? []);
      setLastUpdate(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load(category);
    // Auto-refresh every 60 seconds
    const interval = setInterval(() => load(category), 60_000);
    return () => clearInterval(interval);
  }, [category, load]);

  return (
    <div className="min-h-screen bg-ink">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="font-sans font-black text-4xl sm:text-5xl uppercase text-off-white tracking-tight">
                GLOBAL MARKETS
              </h1>
              <p className="font-mono text-xs text-dim-2 tracking-widest mt-1">
                LIVE ODDS FROM POLYMARKET · UPDATES EVERY 60S
              </p>
            </div>
            <button onClick={() => load(category)}
              disabled={isLoading}
              className="font-mono text-xs text-dim-2 hover:text-off-white border border-border-dark px-3 py-2 flex items-center gap-2 transition-all">
              <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} />
              {lastUpdate ? lastUpdate.toLocaleTimeString() : "REFRESH"}
            </button>
          </div>

          {/* Info banner */}
          <div className="border border-off-white/10 p-3 font-mono text-xs text-dim-2 flex items-center gap-3">
            <span className="text-off-white">ℹ</span>
            <span>THESE MARKETS ARE LIVE ON POLYMARKET (POLYGON + USDC). CLICK ANY MARKET TO TRADE ON POLYMARKET. FOR MEGAETH + USDM TRADING, SEE <a href="/markets" className="text-off-white underline hover:no-underline">BUNNYBET MARKETS</a>.</span>
          </div>
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap gap-2 mb-6">
          {CATEGORIES.map((cat) => (
            <button key={cat} onClick={() => setCategory(cat)}
              className={cn(
                "font-mono text-xs tracking-widest px-3 py-1.5 border transition-all",
                category === cat
                  ? "border-off-white/40 text-off-white bg-off-white/8"
                  : "border-border-dark text-dim-2 hover:text-off-white"
              )}>
              {cat}
            </button>
          ))}
        </div>

        {/* Markets grid */}
        {isLoading && markets.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-56 bg-cream/20 animate-pulse border border-border-dark" />
            ))}
          </div>
        ) : markets.length === 0 ? (
          <div className="text-center py-16">
            <p className="font-mono text-dim-2 text-sm">NO MARKETS FOUND</p>
            <button onClick={() => load(category)} className="font-mono text-xs text-dim-2 hover:text-off-white border border-border-dark px-3 py-2 mt-4">
              RETRY
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {markets.map((m) => <MarketCard key={m.id} m={m} />)}
          </div>
        )}

        {/* Footer attribution */}
        <div className="mt-8 text-center font-mono text-[10px] text-dim-2">
          MARKET DATA PROVIDED BY{" "}
          <a href="https://polymarket.com" target="_blank" rel="noreferrer" className="text-off-white hover:underline">POLYMARKET</a>.
          TRADING EXECUTES ON POLYGON WITH USDC.
        </div>
      </div>
    </div>
  );
}
