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
type InfoTuple = [bigint,bigint,bigint,bigint,bigint,bigint,boolean,boolean,boolean,bigint,boolean];

// Typed multicall result item
type MCResult = { status: "success"; result: unknown } | { status: "failure"; error: unknown };

async function fetchMarketsPage(
  client: NonNullable<ReturnType<typeof usePublicClient>>,
  offset: number,
  limit: number,
): Promise<Market[]> {
  // Step 1: get market addresses
  let addresses: Address[];
  try {
    addresses = (await client.readContract({
      address:      FACTORY_ADDRESS,
      abi:          FACTORY_ABI,
      functionName: "getMarkets",
      args:         [BigInt(offset), BigInt(limit)],
    })) as Address[];
  } catch (e) {
    console.error("[markets] getMarkets error:", e);
    return [];
  }

  if (!addresses?.length) return [];

  // Step 2: multicall — 9 slots per market
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

  let raw: unknown[];
  try {
    raw = (await client.multicall({
      contracts:    calls as Parameters<typeof client.multicall>[0]["contracts"],
      allowFailure: true,
    })) as unknown[];
  } catch (e) {
    console.error("[markets] multicall error:", e);
    return [];
  }

  // Cast raw results
  const results = raw as MCResult[];

  const ok    = (r: MCResult): r is { status: "success"; result: unknown } => r?.status === "success";
  const val   = (r: MCResult) => ok(r) ? r.result : undefined;

  const markets: Market[] = [];
  for (let i = 0; i < addresses.length; i++) {
    const b   = i * STRIDE;
    const get = (n: number): MCResult => results[b + n] ?? { status: "failure", error: null };

    if (!ok(get(0))) continue;

    const infoRaw = ok(get(8)) ? (val(get(8)) as InfoTuple) : null;

    try {
      markets.push({
        address:        addresses[i],
        question:       (val(get(0)) as string)  ?? "",
        description:    (val(get(1)) as string)  ?? "",
        imageUrl:       (val(get(2)) as string)  ?? "",
        category:       (val(get(3)) as string)  ?? "Other",
        endTime:        Number((val(get(4)) as bigint) ?? 0n),
        createdAt:      Number((val(get(5)) as bigint) ?? 0n),
        creator:        (val(get(6)) as Address) ?? ("0x0" as Address),
        platformFeeBps: Number((val(get(7)) as bigint) ?? 200n),
        yesPool:        infoRaw?.[0] ?? 0n,
        noPool:         infoRaw?.[1] ?? 0n,
        totalPool:      infoRaw?.[2] ?? 0n,
        yesProb:        bpsToPercent(infoRaw?.[3] ?? 5000n),
        noProb:         bpsToPercent(infoRaw?.[4] ?? 5000n),
        volume:         infoRaw?.[5] ?? 0n,
        resolved:       infoRaw?.[6] ?? false,
        outcome:        infoRaw?.[7] ?? false,
        cancelled:      infoRaw?.[8] ?? false,
        timeLeft:       Number(infoRaw?.[9] ?? 0n),
        paused:         infoRaw?.[10] ?? false,
      });
    } catch (e) {
      console.error("[markets] parse error index", i, e);
    }
  }
  return markets;
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
    refetchInterval: POLL_INTERVAL_MS * 2,
    staleTime:       POLL_INTERVAL_MS,
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
