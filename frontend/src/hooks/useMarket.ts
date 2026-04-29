"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePublicClient, useWatchContractEvent, useAccount } from "wagmi";
import { type Address, type Market, type UserPosition } from "@/types/market";
import {
  FACTORY_ADDRESS, FACTORY_ABI, MARKET_ABI, POLL_INTERVAL_MS,
} from "@/lib/contracts";
import { bpsToPercent } from "@/lib/utils";

type InfoTuple = [bigint,bigint,bigint,bigint,bigint,bigint,boolean,boolean,boolean,bigint,boolean];

// ── useMarket ─────────────────────────────────────────────────────────────────
export function useMarket(address: Address | undefined) {
  const client = usePublicClient();
  const qc     = useQueryClient();
  const { address: user } = useAccount();

  const mKey = ["market", address];
  const pKey = ["position", address, user];

  const marketQuery = useQuery({
    queryKey: mKey,
    queryFn: async (): Promise<Market | null> => {
      if (!client || !address) return null;
      try {
        // Individual reads — no multicall (MegaETH may not have Multicall3)
        const [question, description, imageUrl, category, endTime, createdAt,
               creator, platformFeeBps, info] = await Promise.all([
          client.readContract({ address, abi: MARKET_ABI, functionName: "question"       }) as Promise<string>,
          client.readContract({ address, abi: MARKET_ABI, functionName: "description"    }) as Promise<string>,
          client.readContract({ address, abi: MARKET_ABI, functionName: "imageUrl"       }) as Promise<string>,
          client.readContract({ address, abi: MARKET_ABI, functionName: "category"       }) as Promise<string>,
          client.readContract({ address, abi: MARKET_ABI, functionName: "endTime"        }) as Promise<bigint>,
          client.readContract({ address, abi: MARKET_ABI, functionName: "createdAt"      }) as Promise<bigint>,
          client.readContract({ address, abi: MARKET_ABI, functionName: "creator"        }) as Promise<Address>,
          client.readContract({ address, abi: MARKET_ABI, functionName: "platformFeeBps" }) as Promise<bigint>,
          client.readContract({ address, abi: MARKET_ABI, functionName: "getMarketInfo"  }) as Promise<InfoTuple>,
        ]);
        return {
          address,
          question, description, imageUrl, category,
          endTime: Number(endTime), createdAt: Number(createdAt), creator,
          platformFeeBps: Number(platformFeeBps),
          yesPool: info[0], noPool: info[1], totalPool: info[2],
          yesProb: bpsToPercent(info[3]), noProb: bpsToPercent(info[4]),
          volume: info[5], resolved: info[6], outcome: info[7],
          cancelled: info[8], timeLeft: Number(info[9]), paused: info[10],
        };
      } catch (e) {
        console.error("[useMarket] read error:", e);
        return null;
      }
    },
    refetchInterval: POLL_INTERVAL_MS * 2,
    staleTime:       POLL_INTERVAL_MS,
    retry:           1,
    enabled:         !!client && !!address,
  });

  const positionQuery = useQuery({
    queryKey: pKey,
    queryFn: async (): Promise<UserPosition | null> => {
      if (!client || !address || !user) return null;
      try {
        const r = await client.readContract({
          address, abi: MARKET_ABI, functionName: "getUserPosition", args: [user],
        }) as [bigint,bigint,bigint,bigint,boolean,boolean];
        return {
          yesShares: r[0], noShares: r[1],
          estimatedYesPayout: r[2], estimatedNoPayout: r[3],
          hasRedeemed: r[4], hasClaimedRefund: r[5],
        };
      } catch { return null; }
    },
    refetchInterval: POLL_INTERVAL_MS * 2,
    staleTime:       POLL_INTERVAL_MS,
    retry:           1,
    enabled:         !!client && !!address && !!user,
  });

  const bust = () => {
    qc.invalidateQueries({ queryKey: mKey });
    qc.invalidateQueries({ queryKey: pKey });
  };

  useWatchContractEvent({
    address, abi: MARKET_ABI, eventName: "SharesBought",
    onLogs: bust, enabled: !!address,
  });
  useWatchContractEvent({
    address, abi: MARKET_ABI, eventName: "MarketResolved",
    onLogs: bust, enabled: !!address,
  });

  return {
    market:          marketQuery.data  ?? null,
    position:        positionQuery.data ?? null,
    isLoading:       marketQuery.isPending && marketQuery.fetchStatus === "fetching",
    error:           marketQuery.error,
    refetch:         marketQuery.refetch,
    refetchPosition: positionQuery.refetch,
  };
}

// ── PortfolioEntry ─────────────────────────────────────────────────────────────
export interface PortfolioEntry { market: Market; position: UserPosition; }

// ── usePortfolio ───────────────────────────────────────────────────────────────
export function usePortfolio() {
  const client = usePublicClient();
  const { address: user } = useAccount();

  return useQuery({
    queryKey: ["portfolio", user],
    queryFn: async (): Promise<PortfolioEntry[]> => {
      if (!client || !user) return [];
      try {
        const total = await client.readContract({
          address: FACTORY_ADDRESS, abi: FACTORY_ABI, functionName: "totalMarkets",
        }) as bigint;
        if (total === 0n) return [];

        let all: Address[] = [];
        let offset = 0n;
        while (offset < total) {
          const batch = await client.readContract({
            address: FACTORY_ADDRESS, abi: FACTORY_ABI, functionName: "getMarkets",
            args: [offset, 50n],
          }) as Address[];
          all = [...all, ...batch];
          offset += 50n;
        }
        if (!all.length) return [];

        // Check positions individually
        const entries: PortfolioEntry[] = [];
        await Promise.all(all.map(async (addr) => {
          try {
            const pos = await client.readContract({
              address: addr, abi: MARKET_ABI, functionName: "getUserPosition", args: [user],
            }) as [bigint,bigint,bigint,bigint,boolean,boolean];

            const [yS, nS, eY, eN, red, ref] = pos;
            if (!(yS > 0n || nS > 0n || red || ref)) return;

            // Read market data
            const [question, description, imageUrl, category, endTime, createdAt,
                   creator, platformFeeBps, info] = await Promise.all([
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

            entries.push({
              market: {
                address: addr, question, description, imageUrl, category,
                endTime: Number(endTime), createdAt: Number(createdAt), creator,
                platformFeeBps: Number(platformFeeBps),
                yesPool: info[0], noPool: info[1], totalPool: info[2],
                yesProb: bpsToPercent(info[3]), noProb: bpsToPercent(info[4]),
                volume: info[5], resolved: info[6], outcome: info[7],
                cancelled: info[8], timeLeft: Number(info[9]), paused: info[10],
              },
              position: {
                yesShares: yS, noShares: nS,
                estimatedYesPayout: eY, estimatedNoPayout: eN,
                hasRedeemed: red, hasClaimedRefund: ref,
              },
            });
          } catch { /* skip market on error */ }
        }));
        return entries;
      } catch { return []; }
    },
    refetchInterval: 10_000,
    staleTime:       5_000,
    retry:           1,
    enabled: !!client && !!user,
  });
}
