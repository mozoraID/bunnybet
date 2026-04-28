"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain }      from "viem";
import { http }             from "wagmi";

export const megaETH = defineChain({
  id: 4326,
  name: "MegaETH",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http:      [process.env.NEXT_PUBLIC_RPC_URL ?? "https://mainnet.megaeth.com/rpc"],
      webSocket: [process.env.NEXT_PUBLIC_WS_URL  ?? "wss://mainnet.megaeth.com/ws"],
    },
  },
  blockExplorers: {
    default: { name: "Blockscout", url: "https://megaeth.blockscout.com", apiUrl: "https://megaeth.blockscout.com/api" },
    etherscan: { name: "MegaEtherscan", url: "https://mega.etherscan.io" },
  },
  testnet: false,
});

export const wagmiConfig = getDefaultConfig({
  appName:   "BunnyBet",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "bunnybet",
  chains:    [megaETH],
  transports: { [megaETH.id]: http(process.env.NEXT_PUBLIC_RPC_URL ?? "https://mainnet.megaeth.com/rpc") },
  ssr: true,
});
