export type Address = `0x${string}`;

export interface Market {
  address:        Address;
  creator:        Address;
  question:       string;
  description:    string;
  imageUrl:       string;
  category:       string;
  endTime:        number;
  createdAt:      number;
  platformFeeBps: number;      // ← NEW: per-market fee config
  // Live pool data (USDM, 18 decimals)
  yesPool:    bigint;
  noPool:     bigint;
  totalPool:  bigint;
  yesProb:    number;          // 0–100
  noProb:     number;
  volume:     bigint;
  resolved:   boolean;
  outcome:    boolean;
  cancelled:  boolean;
  paused:     boolean;         // ← NEW: market pause state
  timeLeft:   number;
}

export interface UserPosition {
  yesShares:          bigint;
  noShares:           bigint;
  estimatedYesPayout: bigint;
  estimatedNoPayout:  bigint;
  hasRedeemed:        boolean;
  hasClaimedRefund:   boolean;
}

export interface CreateMarketForm {
  question:    string;
  description: string;
  imageUrl:    string;
  category:    string;
  endDate:     string;
}

export type MarketStatus = "open" | "expired" | "resolved" | "cancelled" | "paused";

export const CATEGORIES = [
  "All", "Crypto", "Politics", "Sports",
  "Tech", "Finance", "Entertainment", "Other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export function getMarketStatus(market: Market): MarketStatus {
  if (market.cancelled)           return "cancelled";
  if (market.resolved)            return "resolved";
  if (market.paused)              return "paused";
  if (market.timeLeft <= 0)       return "expired";
  return "open";
}