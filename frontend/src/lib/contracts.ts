import type { Address } from "@/types/market";
import FactoryABI from "@/lib/abis/PredictionMarketFactory.json";
import MarketABI  from "@/lib/abis/PredictionMarket.json";
import ERC20ABI   from "@/lib/abis/ERC20.json";

// ─── Addresses (from env) ─────────────────────────────────────────────────────
export const FACTORY_ADDRESS: Address = (
  process.env.NEXT_PUBLIC_FACTORY_ADDRESS ?? "0x0000000000000000000000000000000000000000"
) as Address;

export const USDM_ADDRESS: Address = (
  process.env.NEXT_PUBLIC_USDM_ADDRESS ??
  "0xFAfDdbb3FC7688494971a79cc65DCa3EF82079E7"   // MegaETH Mainnet USDM
) as Address;

// ─── ABIs ─────────────────────────────────────────────────────────────────────
export const FACTORY_ABI = FactoryABI as const;
export const MARKET_ABI  = MarketABI  as const;
export const ERC20_ABI   = ERC20ABI   as const;

// ─── Explorer ─────────────────────────────────────────────────────────────────
const EXPLORER = "https://megaeth.blockscout.com";
export const txUrl   = (hash: string) => `${EXPLORER}/tx/${hash}`;
export const addrUrl = (addr: string) => `${EXPLORER}/address/${addr}`;

// ─── Constants ────────────────────────────────────────────────────────────────
export const MIN_BET_USDM     = 1;           // 1 USDM
export const CREATOR_FEE_BPS  = 100;         // 1 % fixed
export const FEE_DENOMINATOR  = 10_000;
export const POLL_INTERVAL_MS = 2_000;
export const MARKETS_PER_PAGE = 24;
export const USDM_DECIMALS    = 18;