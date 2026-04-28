/**
 * GET /api/prices
 *
 * Self-hosted price proxy — fetches USD prices for crypto assets from
 * Chainlink-compatible public sources (CoinGecko public API, no key needed).
 * Returns prices keyed by symbol, suitable for market context display.
 *
 * Cache: 30 seconds (stale-while-revalidate for fast response)
 */

import { NextResponse } from "next/server";

// Symbols we care about → CoinGecko IDs
const SYMBOL_TO_CG: Record<string, string> = {
  BTC:   "bitcoin",
  ETH:   "ethereum",
  BNB:   "binancecoin",
  SOL:   "solana",
  MATIC: "matic-network",
  ARB:   "arbitrum",
  OP:    "optimism",
  AVAX:  "avalanche-2",
  LINK:  "chainlink",
  DOGE:  "dogecoin",
};

export interface PriceData {
  symbol:        string;
  price:         number;
  change24h:     number;  // percent
  lastUpdatedAt: number;  // unix ms
}

export interface PricesResponse {
  prices:    Record<string, PriceData>;
  updatedAt: number;
}

async function fetchCoinGeckoPrices(): Promise<Record<string, PriceData>> {
  const ids = Object.values(SYMBOL_TO_CG).join(",");
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 30 },  // ISR-style cache for 30 seconds
  });

  if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`);
  const raw = await res.json();

  const result: Record<string, PriceData> = {};
  for (const [symbol, id] of Object.entries(SYMBOL_TO_CG)) {
    const d = raw[id];
    if (!d) continue;
    result[symbol] = {
      symbol,
      price:         d.usd            ?? 0,
      change24h:     d.usd_24h_change ?? 0,
      lastUpdatedAt: (d.last_updated_at ?? Math.floor(Date.now() / 1000)) * 1000,
    };
  }
  return result;
}

export async function GET() {
  try {
    const prices = await fetchCoinGeckoPrices();
    const body: PricesResponse = { prices, updatedAt: Date.now() };

    return NextResponse.json(body, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    console.error("[/api/prices] fetch error:", err);
    return NextResponse.json(
      { error: "Failed to fetch prices", prices: {}, updatedAt: Date.now() },
      { status: 500 }
    );
  }
}
