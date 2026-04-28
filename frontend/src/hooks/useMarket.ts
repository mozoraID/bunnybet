"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  usePublicClient,
  useWatchContractEvent,
  useAccount,
} from "wagmi";
import {
  type Address,
  type Market,
  type UserPosition,
} from "@/types/market";
import {
  FACTORY_ADDRESS, FACTORY_ABI, MARKET_ABI, POLL_INTERVAL_MS,
} from "@/lib/contracts";
import { bpsToPercent } from "@/lib/utils";

// 9 multicall slots per market (same as useMarkets.ts)
const STRIDE = 9;
type InfoTuple = [
  bigint, bigint, bigint, bigint, bigint, bigint,
  boolean, boolean, boolean, bigint, boolean,
];

// ─────────────────────────────────────────────────────────────────
// useMarket — single market detail + user position
// ─────────────────────────────────────────────────────────────────
export function useMarket(address: Address | undefined) {
  const client = usePublicClient();
  const qc     = useQueryClient();
  const { address: user } = useAccount();

  const mKey = ["market", address];
  const pKey = ["position", address, user];

  // ── Market state ──────────────────────────────────────────────
  const marketQuery = useQuery({
    queryKey: mKey,
    queryFn: async (): Promise<Market | null> => {
      if (!client || !address) return null;

      const calls = [
        { address, abi: MARKET_ABI, functionName: "question"       },
        { address, abi: MARKET_ABI, functionName: "description"    },
        { address, abi: MARKET_ABI, functionName: "imageUrl"       },
        { address, abi: MARKET_ABI, functionName: "category"       },
        { address, abi: MARKET_ABI, functionName: "endTime"        },
        { address, abi: MARKET_ABI, functionName: "createdAt"      },
        { address, abi: MARKET_ABI, functionName: "creator"        },
        { address, abi: MARKET_ABI, functionName: "platformFeeBps" },
        { address, abi: MARKET_ABI, functionName: "getMarketInfo"  },
      ];

      const r = await client.multicall({
        contracts:    calls as Parameters<typeof client.multicall>[0]["contracts"],
        allowFailure: false,
      });

      const info = r[8] as InfoTuple;

      return {
        address,
        question:       r[0] as string,
        description:    r[1] as string,
        imageUrl:       r[2] as string,
        category:       r[3] as string,
        endTime:        Number(r[4] as bigint),
        createdAt:      Number(r[5] as bigint),
        creator:        r[6] as Address,
        platformFeeBps: Number(r[7] as bigint),
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
    },
    refetchInterval: POLL_INTERVAL_MS,
    staleTime:       POLL_INTERVAL_MS / 2,
    enabled:         !!client && !!address,
  });

  // ── User position ─────────────────────────────────────────────
  const positionQuery = useQuery({
    queryKey: pKey,
    queryFn: async (): Promise<UserPosition | null> => {
      if (!client || !address || !user) return null;
      const r = await client.readContract({
        address,
        abi:          MARKET_ABI,
        functionName: "getUserPosition",
        args:         [user],
      }) as [bigint, bigint, bigint, bigint, boolean, boolean];
      return {
        yesShares:          r[0],
        noShares:           r[1],
        estimatedYesPayout: r[2],
        estimatedNoPayout:  r[3],
        hasRedeemed:        r[4],
        hasClaimedRefund:   r[5],
      };
    },
    refetchInterval: POLL_INTERVAL_MS,
    staleTime:       POLL_INTERVAL_MS / 2,
    enabled:         !!client && !!address && !!user,
  });

  // ── Real-time events (MegaETH ~10ms blocks) ───────────────────
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
    isLoading:       marketQuery.isLoading,
    error:           marketQuery.error,
    refetch:         marketQuery.refetch,
    refetchPosition: positionQuery.refetch,
  };
}

// ─────────────────────────────────────────────────────────────────
// PortfolioEntry type (exported for portfolio page)
// ─────────────────────────────────────────────────────────────────
export interface PortfolioEntry {
  market:   Market;
  position: UserPosition;
}

// ─────────────────────────────────────────────────────────────────
// usePortfolio — all markets where the connected wallet has a stake
// ─────────────────────────────────────────────────────────────────
export function usePortfolio() {
  const client = usePublicClient();
  const { address: user } = useAccount();

  return useQuery({
    queryKey: ["portfolio", user],
    queryFn: async (): Promise<PortfolioEntry[]> => {
      if (!client || !user) return [];

      // 1. Total market count
      const total = (await client.readContract({
        address:      FACTORY_ADDRESS,
        abi:          FACTORY_ABI,
        functionName: "totalMarkets",
      })) as bigint;
      if (total === 0n) return [];

      // 2. Paginate all addresses (100 per call)
      let all: Address[] = [];
      let offset = 0n;
      while (offset < total) {
        const batch = (await client.readContract({
          address:      FACTORY_ADDRESS,
          abi:          FACTORY_ABI,
          functionName: "getMarkets",
          args:         [offset, 100n],
        })) as Address[];
        all = [...all, ...batch];
        offset += 100n;
      }
      if (!all.length) return [];

      // 3. Batch getUserPosition for every market
      const posCalls = all.map((a) => ({
        address: a, abi: MARKET_ABI, functionName: "getUserPosition", args: [user],
      }));
      const posResults = await client.multicall({
        contracts:    posCalls as Parameters<typeof client.multicall>[0]["contracts"],
        allowFailure: true,
      });

      // 4. Filter to markets with any position
      const active: Address[]       = [];
      const positions: UserPosition[] = [];
      for (let i = 0; i < all.length; i++) {
        const r = posResults[i];
        if (r.status !== "success") continue;
        const [yS, nS, eY, eN, red, ref] =
          r.result as [bigint, bigint, bigint, bigint, boolean, boolean];
        if (yS > 0n || nS > 0n || red || ref) {
          active.push(all[i]);
          positions.push({
            yesShares: yS, noShares: nS,
            estimatedYesPayout: eY, estimatedNoPayout: eN,
            hasRedeemed: red, hasClaimedRefund: ref,
          });
        }
      }
      if (!active.length) return [];

      // 5. Fetch metadata for active markets
      const infoCalls = active.flatMap((a) => [
        { address: a, abi: MARKET_ABI, functionName: "question"       },
        { address: a, abi: MARKET_ABI, functionName: "description"    },
        { address: a, abi: MARKET_ABI, functionName: "imageUrl"       },
        { address: a, abi: MARKET_ABI, functionName: "category"       },
        { address: a, abi: MARKET_ABI, functionName: "endTime"        },
        { address: a, abi: MARKET_ABI, functionName: "createdAt"      },
        { address: a, abi: MARKET_ABI, functionName: "creator"        },
        { address: a, abi: MARKET_ABI, functionName: "platformFeeBps" },
        { address: a, abi: MARKET_ABI, functionName: "getMarketInfo"  },
      ]);
      const ir = await client.multicall({
        contracts:    infoCalls as Parameters<typeof client.multicall>[0]["contracts"],
        allowFailure: true,
      });

      const entries: PortfolioEntry[] = [];
      for (let i = 0; i < active.length; i++) {
        const b   = i * STRIDE;
        const g   = (n: number) => ir[b + n];
        if (g(0).status !== "success") continue;
        const info = g(8).status === "success"
          ? (g(8).result as InfoTuple)
          : null;

        entries.push({
          market: {
            address:        active[i],
            question:       (g(0).result as string)  ?? "",
            description:    (g(1).result as string)  ?? "",
            imageUrl:       (g(2).result as string)  ?? "",
            category:       (g(3).result as string)  ?? "Other",
            endTime:        Number((g(4).result as bigint) ?? 0n),
            createdAt:      Number((g(5).result as bigint) ?? 0n),
            creator:        (g(6).result as Address) ?? "0x0",
            platformFeeBps: Number((g(7).result as bigint) ?? 200n),
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
          },
          position: positions[i],
        });
      }
      return entries;
    },
    refetchInterval: POLL_INTERVAL_MS * 3,
    staleTime:       POLL_INTERVAL_MS,
    enabled: !!client && !!user,
  });
}
