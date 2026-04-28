// ── BunnyBet core types ───────────────────────────────────────────
export type Address = `0x${string}`;

export interface Market {
  address:        Address;
  creator:        Address;
  question:       string;
  description:    string;
  imageUrl:       string;
  category:       string;
  endTime:        number;   // unix seconds
  createdAt:      number;
  platformFeeBps: number;
  // Live pool data (USDM, 18 decimals)
  yesPool:   bigint;
  noPool:    bigint;
  totalPool: bigint;
  yesProb:   number;   // 0–100 (percentage)
  noProb:    number;
  volume:    bigint;
  resolved:  boolean;
  outcome:   boolean;
  cancelled: boolean;
  paused:    boolean;
  timeLeft:  number;   // seconds
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

/** Map category → relevant Chainlink price pair symbol */
export const CATEGORY_PRICE_PAIR: Partial<Record<string, string>> = {
  Crypto:  "ETH",
  Finance: "BTC",
  Tech:    "ETH",
};

export function getMarketStatus(m: Market): MarketStatus {
  if (m.cancelled)      return "cancelled";
  if (m.resolved)       return "resolved";
  if (m.paused)         return "paused";
  if (m.timeLeft <= 0)  return "expired";
  return "open";
}
