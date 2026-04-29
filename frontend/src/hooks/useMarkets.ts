"use client";

import { useQuery }         from "@tanstack/react-query";
import { usePublicClient, useWatchContractEvent } from "wagmi";
import { useState, useCallback } from "react";
import { type Address, type Market } from "@/types/market";
import {
  FACTORY_ADDRESS, FACTORY_ABI, MARKET_ABI,
  MARKETS_PER_PAGE, POLL_INTERVAL_MS,
} from "@/lib/contracts";
import { bpsToPercent } from "@/lib/utils";

const STRIDE = 9;

type InfoTuple = [
  bigint, bigint, bigint, bigint, bigint, bigint,
  boolean, boolean, boolean, bigint, boolean,
];

async function fetchMarketsPage(
  client: ReturnType<typeof usePublicClient>,
  offset: number,
  limit: number,
): Promise<Market[]> {
  if (!client) return [];

  // Step 1: Get addresses
  let addresses: Address[] = [];
  try {
    addresses = (await client.readContract({
      address:      FACTORY_ADDRESS,
      abi:          FACTORY_ABI,
      functionName: "getMarkets",
      args:         [BigInt(offset), BigInt(limit)],
    })) as Address[];
  } catch (e) {
    console.error("[useMarkets] getMarkets failed:", e);
    return [];
  }

  if (!addresses || !addresses.length) return [];

  // Step 2: Batch fetch market data
  const calls = addresses.flatMap((addr) => [
    { address: addr, abi: MARKET_ABI, functionName: "question"       },
    { address: addr, abi: MARKET_ABI, functionName: "description"    },
    { address: addr, abi: MARKET_ABI, functionName: "imageUrl"       },
    { address: addr, abi: MARKET_ABI, functionName: "category"       },
    { address: addr, abi: MARKET_ABI, functionName: "endTime"        },
    { address: addr, abi: MARKET_ABI, functionName: "createdAt"      },
    { address: addr, abi: MARKET_ABI, functionName: "creator"        },
    { address: addr, abi: MARKET_ABI, functionName: "platformFeeBps" },
    { address: addr, abi: MARKET_ABI, functionName: "getMarketInfo"  },
  ]);

  let results: Awaited<ReturnType<typeof client.multicall>>;
  try {
    results = await client.multicall({
      contracts:    calls as Parameters<typeof client.multicall>[0]["contracts"],
      allowFailure: true,
    });
  } catch (e) {
    console.error("[useMarkets] multicall failed:", e);
    return [];
  }

  const markets: Market[] = [];
  for (let i = 0; i < addresses.length; i++) {
    const b   = i * STRIDE;
    const get = (n: number) => results[b + n];
    if (!get(0) || get(0).status !== "success") continue;

    const info = get(8)?.status === "success"
      ? (get(8).result as InfoTuple)
      : null;

    try {
      markets.push({
        address:        addresses[i],
        question:       (get(0).result as string)  ?? "",
        description:    (get(1).result as string)  ?? "",
        imageUrl:       (get(2).result as string)  ?? "",
        category:       (get(3).result as string)  ?? "Other",
        endTime:        Number((get(4).result as bigint) ?? 0n),
        createdAt:      Number((get(5).result as bigint) ?? 0n),
        creator:        (get(6).result as Address) ?? "0x0",
        platformFeeBps: Number((get(7).result as bigint) ?? 200n),
        yesPool:        info?.[0] ?? 0n,
        noPool:         info?.[1] ?? 0n,
        totalPool:      info?.[2] ?? 0n,
        yesProb:        bpsToPercent(info?.[3] ?? 5000n),
        noProb:         bpsToPercent(info?.[4] ?? 5000n),
        volume:         info?.[5] ?? 0n,
        resolved:       info?.[6] ?? false,
        outcome:        info?.[7] ?? false,
        cancelled:      info?.[8] ?? false,
        timeLeft:       Number(info?.[9] ?? 0n),
        paused:         info?.[10] ?? false,
      });
    } catch (e) {
      console.error("[useMarkets] market parse error at index", i, e);
    }
  }
  return markets;
}

export function useMarkets(initialLimit = MARKETS_PER_PAGE) {
  const client = usePublicClient();
  const [offset, setOffset] = useState(0);

  const query = useQuery({
    queryKey:        ["markets", offset, initialLimit],
    queryFn:         async () => {
      try {
        return await fetchMarketsPage(client, offset, initialLimit);
      } catch (e) {
        console.error("[useMarkets] query error:", e);
        return []; // Never leave stuck in loading — always resolve
      }
    },
    refetchInterval: POLL_INTERVAL_MS * 2, // 4s — not too aggressive
    staleTime:       POLL_INTERVAL_MS,
    retry:           1,   // Only retry once to avoid long stuck states
    enabled:         !!client,
    placeholderData: (prev) => prev,
  });

  useWatchContractEvent({
    address:   FACTORY_ADDRESS,
    abi:       FACTORY_ABI,
    eventName: "MarketCreated",
    onLogs:    () => query.refetch(),
    enabled:   !!client,
  });

  return {
    markets:    query.data    ?? [],
    isLoading:  query.isLoading && !query.isPlaceholderData,
    isFetching: query.isFetching,
    error:      query.error,
    refetch:    query.refetch,
    loadMore:   useCallback(() => setOffset((o) => o + initialLimit), [initialLimit]),
    hasMore:    (query.data?.length ?? 0) >= initialLimit,
  };
}

export function useMarketCount() {
  const client = usePublicClient();
  return useQuery({
    queryKey:        ["marketCount"],
    queryFn:         async () => {
      if (!client) return 0n;
      try {
        return await client.readContract({
          address:      FACTORY_ADDRESS,
          abi:          FACTORY_ABI,
          functionName: "totalMarkets",
        }) as bigint;
      } catch {
        return 0n;
      }
    },
    refetchInterval: 10_000,
    retry:           1,
    enabled:         !!client,
  });
}
