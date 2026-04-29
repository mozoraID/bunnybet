import type { Address } from "@/types/market";
import FactoryABI  from "@/lib/abis/PredictionMarketFactory.json";
import MarketABI   from "@/lib/abis/PredictionMarket.json";
import ERC20ABI    from "@/lib/abis/ERC20.json";
import VaultABI    from "@/lib/abis/BunnyBetVault.json";

export const FACTORY_ADDRESS: Address = (
  process.env.NEXT_PUBLIC_FACTORY_ADDRESS ??
  "0x2f312fFEF4Acc6B91E036Bc5945da87bf0049d7b"
) as Address;

export const USDM_ADDRESS: Address = (
  process.env.NEXT_PUBLIC_USDM_ADDRESS ??
  "0xFAfDdbb3FC7688494971a79cc65DCa3EF82079E7"
) as Address;

export const VAULT_ADDRESS: Address = (
  process.env.NEXT_PUBLIC_VAULT_ADDRESS ??
  "0x0000000000000000000000000000000000000000"
) as Address;

export const FACTORY_ABI = FactoryABI;
export const MARKET_ABI  = MarketABI;
export const ERC20_ABI   = ERC20ABI;
export const VAULT_ABI   = VaultABI;

const EXPLORER = "https://megaeth.blockscout.com";
export const txUrl   = (hash: string) => `${EXPLORER}/tx/${hash}`;
export const addrUrl = (addr: string) => `${EXPLORER}/address/${addr}`;

export const MIN_BET_USDM     = 1;
export const CREATOR_FEE_BPS  = 100;
export const FEE_DENOMINATOR  = 10_000;
export const POLL_INTERVAL_MS = 2_000;
export const MARKETS_PER_PAGE = 24;
export const USDM_DECIMALS    = 18;
