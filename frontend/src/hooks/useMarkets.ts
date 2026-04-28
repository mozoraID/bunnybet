"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient, useWatchContractEvent } from "wagmi";
import { useState, useCallback } from "react";
import { type Address, type Market } from "@/types/market";
import {
  FACTORY_ADDRESS, FACTORY_ABI, MARKET_ABI,
  MARKETS_PER_PAGE, POLL_INTERVAL_MS,
} from "@/lib/contracts";
import { bpsToPercent } from "@/lib/utils";

// 9 multicall slots per market:
// 0=question 1=description 2=imageUrl 3=category 4=endTime
// 5=createdAt 6=creator 7=platformFeeBps 8=getMarketInfo
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

  const addresses = (await client.readContract({
    address:      FACTORY_ADDRESS,
    abi:          FACTORY_ABI,
    functionName: "getMarkets",
    args:         [BigInt(offset), BigInt(limit)],
  })) as Address[];

  if (!addresses.length) return [];

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

  const results = await client.multicall({
    contracts:    calls as Parameters<typeof client.multicall>[0]["contracts"],
    allowFailure: true,
  });

  const markets: Market[] = [];

  for (let i = 0; i < addresses.length; i++) {
    const b   = i * STRIDE;
    const get = (n: number) => results[b + n];
    if (get(0).status !== "success") continue;

    const info = get(8).status === "success"
      ? (get(8).result as InfoTuple)
      : null;

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
  }
  return markets;
}

export function useMarkets(initialLimit = MARKETS_PER_PAGE) {
  const client = usePublicClient();
  const [offset, setOffset] = useState(0);

  const query = useQuery({
    queryKey:        ["markets", offset, initialLimit],
    queryFn:         () => fetchMarketsPage(client, offset, initialLimit),
    refetchInterval: POLL_INTERVAL_MS,
    staleTime:       POLL_INTERVAL_MS / 2,
    enabled:         !!client,
    placeholderData: (prev) => prev,
  });

  // Immediately refetch on new market creation
  useWatchContractEvent({
    address:   FACTORY_ADDRESS,
    abi:       FACTORY_ABI,
    eventName: "MarketCreated",
    onLogs:    () => query.refetch(),
  });

  return {
    markets:    query.data ?? [],
    isLoading:  query.isLoading,
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
      return client.readContract({
        address:      FACTORY_ADDRESS,
        abi:          FACTORY_ABI,
        functionName: "totalMarkets",
      }) as Promise<bigint>;
    },
    refetchInterval: 10_000,
    enabled: !!client,
  });
}
