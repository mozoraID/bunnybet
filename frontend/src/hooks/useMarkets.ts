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

type InfoTuple = [bigint,bigint,bigint,bigint,bigint,bigint,boolean,boolean,boolean,bigint,boolean];

/** Read a single market — no multicall, pure individual readContract calls */
async function readMarket(
  client: NonNullable<ReturnType<typeof usePublicClient>>,
  addr: Address,
): Promise<Market | null> {
  try {
    // Parallel reads — faster than sequential, no multicall needed
    const [question, description, imageUrl, category, endTime, createdAt, creator, platformFeeBps, info] =
      await Promise.all([
        client.readContract({ address: addr, abi: MARKET_ABI, functionName: "question"       }) as Promise<string>,
        client.readContract({ address: addr, abi: MARKET_ABI, functionName: "description"    }) as Promise<string>,
        client.readContract({ address: addr, abi: MARKET_ABI, functionName: "imageUrl"       }) as Promise<string>,
        client.readContract({ address: addr, abi: MARKET_ABI, functionName: "category"       }) as Promise<string>,
        client.readContract({ address: addr, abi: MARKET_ABI, functionName: "endTime"        }) as Promise<bigint>,
        client.readContract({ address: addr, abi: MARKET_ABI, functionName: "createdAt"      }) as Promise<bigint>,
        client.readContract({ address: addr, abi: MARKET_ABI, functionName: "creator"        }) as Promise<Address>,
        client.readContract({ address: addr, abi: MARKET_ABI, functionName: "platformFeeBps" }) as Promise<bigint>,
        client.readContract({ address: addr, abi: MARKET_ABI, functionName: "getMarketInfo"  }) as Promise<InfoTuple>,
      ]);

    return {
      address:        addr,
      question,
      description,
      imageUrl,
      category,
      endTime:        Number(endTime),
      createdAt:      Number(createdAt),
      creator,
      platformFeeBps: Number(platformFeeBps),
      yesPool:        info[0],
      noPool:         info[1],
      totalPool:      info[2],
      yesProb:        bpsToPercent(info[3]),
      noProb:         bpsToPercent(info[4]),
      volume:         info[5],
      resolved:       info[6],
      outcome:        info[7],
      cancelled:      info[8],
      timeLeft:       Number(info[9]),
      paused:         info[10],
    };
  } catch (e) {
    console.error("[market] failed to read", addr, e);
    return null;
  }
}

async function fetchMarketsPage(
  client: NonNullable<ReturnType<typeof usePublicClient>>,
  offset: number,
  limit: number,
): Promise<Market[]> {
  // 1. Get addresses from factory
  let addresses: Address[];
  try {
    addresses = (await client.readContract({
      address:      FACTORY_ADDRESS,
      abi:          FACTORY_ABI,
      functionName: "getMarkets",
      args:         [BigInt(offset), BigInt(limit)],
    })) as Address[];
  } catch (e) {
    console.error("[markets] getMarkets failed:", e);
    return [];
  }

  if (!addresses?.length) return [];

  // 2. Read all markets in parallel (no multicall)
  const results = await Promise.all(addresses.map((addr) => readMarket(client, addr)));

  // Deduplicate by question text (bot may create duplicates)
  const seen = new Set<string>();
  return results.filter((m): m is Market => {
    if (!m || seen.has(m.question)) return false;
    seen.add(m.question);
    return true;
  });
}

export function useMarkets(initialLimit = MARKETS_PER_PAGE) {
  const client  = usePublicClient();
  const [offset, setOffset] = useState(0);

  const query = useQuery({
    queryKey:        ["markets", offset, initialLimit],
    queryFn:         async (): Promise<Market[]> => {
      if (!client) return [];
      try {
        return await fetchMarketsPage(client, offset, initialLimit);
      } catch {
        return [];
      }
    },
    refetchInterval: 5_000,
    staleTime:       2_000,
    retry:           1,
    enabled:         !!client,
    placeholderData: (prev: Market[] | undefined) => prev,
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
    isLoading:  query.isPending && query.fetchStatus === "fetching",
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
