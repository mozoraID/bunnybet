/**
 * Relay Protocol — using @relayprotocol/relay-sdk + relay-kit-hooks
 * Docs: https://docs.relay.link
 */
"use client";

import {
  createClient,
  convertViemChainToRelayChain,
  MAINNET_RELAY_API,
} from "@relayprotocol/relay-sdk";
import { megaETH } from "@/lib/wagmi";

export const MEGAETH_CHAIN_ID = 4326;
export const USDM_MEGAETH    = "0xFAfDdbb3FC7688494971a79cc65DCa3EF82079E7" as const;
export const NATIVE_TOKEN    = "0x0000000000000000000000000000000000000000" as const;

// BunnyBet 0.01% fee on every bridge (100 ppm = 0.01%)
export const BUNNYBET_APP_FEES = [
  {
    recipient: "0xD3E17d9BC3F3A038382c19fFB8b52BABeCf2E494" as `0x${string}`,
    fee: "100",
  },
];

// Init Relay client singleton
let _init = false;
export function initRelayClient() {
  if (_init || typeof window === "undefined") return;
  _init = true;
  createClient({
    baseApiUrl: MAINNET_RELAY_API,
    source:     "bunnybet.xyz",
    chains:     [convertViemChainToRelayChain(megaETH)],
  });
}

export interface RelayToken { symbol: string; address: string; decimals: number; }

export const RELAY_CHAINS = [
  { id: 1,     name: "Ethereum", emoji: "🔷" },
  { id: 137,   name: "Polygon",  emoji: "🟣" },
  { id: 56,    name: "BSC",      emoji: "🟡" },
  { id: 42161, name: "Arbitrum", emoji: "🔵" },
  { id: 8453,  name: "Base",     emoji: "🔵" },
];

export const RELAY_TOKENS: Record<number, RelayToken[]> = {
  1:     [{ symbol:"ETH",  address: NATIVE_TOKEN, decimals:18 }, { symbol:"USDC", address:"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals:6 }, { symbol:"USDT", address:"0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals:6 }],
  137:   [{ symbol:"POL",  address: NATIVE_TOKEN, decimals:18 }, { symbol:"USDC", address:"0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", decimals:6 }, { symbol:"USDT", address:"0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals:6 }],
  56:    [{ symbol:"BNB",  address: NATIVE_TOKEN, decimals:18 }, { symbol:"USDT", address:"0x55d398326f99059fF775485246999027B3197955", decimals:18 }, { symbol:"USDC", address:"0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", decimals:18 }],
  42161: [{ symbol:"ETH",  address: NATIVE_TOKEN, decimals:18 }, { symbol:"USDC", address:"0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals:6 }, { symbol:"USDT", address:"0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals:6 }],
  8453:  [{ symbol:"ETH",  address: NATIVE_TOKEN, decimals:18 }, { symbol:"USDC", address:"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals:6 }],
};
