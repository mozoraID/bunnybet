"use client";

import { useQuery } from "@tanstack/react-query";
import type { PricesResponse, PriceData } from "@/app/api/prices/route";

async function fetchPrices(): Promise<PricesResponse> {
  const res = await fetch("/api/prices");
  if (!res.ok) throw new Error("Price fetch failed");
  return res.json();
}

/** Hook: fetch all USD prices from our Chainlink-compatible proxy. */
export function usePrices() {
  return useQuery({
    queryKey:       ["prices"],
    queryFn:        fetchPrices,
    refetchInterval: 30_000,   // 30 seconds
    staleTime:       25_000,
    gcTime:          60_000,
    retry:           2,
  });
}

/** Helper: get a single symbol's price data from the query result. */
export function useSinglePrice(symbol: string | undefined): PriceData | undefined {
  const { data } = usePrices();
  if (!symbol || !data) return undefined;
  return data.prices[symbol.toUpperCase()];
}
