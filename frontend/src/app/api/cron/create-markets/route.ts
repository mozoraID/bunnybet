/**
 * POST /api/cron/create-markets
 *
 * Vercel Cron Job — runs daily (configured in vercel.json).
 * Bot wallet reads a curated market template list, picks markets
 * that don't exist yet, and creates them on MegaETH via the factory.
 *
 * Security:
 * • Protected by CRON_SECRET header (set in Vercel env)
 * • Bot private key stored only in Vercel env (never in code)
 * • Max 3 markets per run (rate limiting)
 * • All market text is pre-approved — no user input
 */

import { NextRequest, NextResponse } from "next/server";
import { createWalletClient, createPublicClient, http, parseAbiItem } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { megaETH } from "@/lib/wagmi";

// ─── Market Templates ─────────────────────────────────────────────
// Curated list of high-quality market topics.
// Add more here — bot picks ones not yet on-chain.

const MARKET_TEMPLATES = [
  // ─── Crypto ───────────────────────────────────────────────────
  {
    question: "Will Bitcoin (BTC) reach $120,000 USD by end of 2025?",
    description: "Resolves YES if BTC/USD price on CoinGecko or Binance reaches or exceeds $120,000 at any point before December 31, 2025 23:59 UTC.",
    category: "Crypto",
    daysFromNow: 120,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Bitcoin.svg/240px-Bitcoin.svg.png",
  },
  {
    question: "Will Ethereum (ETH) reach $5,000 USD by end of 2025?",
    description: "Resolves YES if ETH/USD price on CoinGecko reaches or exceeds $5,000 at any point before December 31, 2025 23:59 UTC.",
    category: "Crypto",
    daysFromNow: 120,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Ethereum_logo_translucent.svg/240px-Ethereum_logo_translucent.svg.png",
  },
  {
    question: "Will MegaETH TVL exceed $500M by Q2 2026?",
    description: "Resolves YES if DeFiLlama reports MegaETH chain TVL >= $500,000,000 USD at any point before June 30, 2026 23:59 UTC.",
    category: "Crypto",
    daysFromNow: 60,
    imageUrl: "",
  },
  {
    question: "Will Solana (SOL) reach $300 USD by end of 2025?",
    description: "Resolves YES if SOL/USD price on CoinGecko reaches or exceeds $300 at any point before December 31, 2025 23:59 UTC.",
    category: "Crypto",
    daysFromNow: 120,
    imageUrl: "",
  },
  {
    question: "Will BTC ETF total AUM exceed $100 billion in 2025?",
    description: "Resolves YES if the total assets under management across all US Bitcoin Spot ETFs exceeds $100 billion USD, as reported by Bloomberg or CoinGlass, before December 31, 2025.",
    category: "Crypto",
    daysFromNow: 90,
    imageUrl: "",
  },
  {
    question: "Will the total crypto market cap exceed $5 trillion in 2025?",
    description: "Resolves YES if CoinGecko total market cap chart shows >= $5T at any point before December 31, 2025.",
    category: "Crypto",
    daysFromNow: 120,
    imageUrl: "",
  },
  // ─── Finance ──────────────────────────────────────────────────
  {
    question: "Will the US Federal Reserve cut interest rates in Q1 2026?",
    description: "Resolves YES if the Federal Reserve announces a federal funds rate reduction at its January or March 2026 FOMC meeting.",
    category: "Finance",
    daysFromNow: 90,
    imageUrl: "",
  },
  {
    question: "Will NASDAQ 100 reach 25,000 by end of 2025?",
    description: "Resolves YES if NASDAQ 100 index (NDX) closes at or above 25,000 at any session before December 31, 2025.",
    category: "Finance",
    daysFromNow: 100,
    imageUrl: "",
  },
  // ─── Tech ─────────────────────────────────────────────────────
  {
    question: "Will Apple release an AI-native iPhone model in 2025?",
    description: "Resolves YES if Apple announces and ships an iPhone model marketed primarily around on-device AI features before December 31, 2025, per major tech publications.",
    category: "Tech",
    daysFromNow: 100,
    imageUrl: "",
  },
  {
    question: "Will OpenAI release GPT-5 publicly in 2025?",
    description: "Resolves YES if OpenAI publicly releases a model officially named GPT-5 or GPT-5-class as a broadly available product before December 31, 2025.",
    category: "Tech",
    daysFromNow: 100,
    imageUrl: "",
  },
  // ─── Sports ───────────────────────────────────────────────────
  {
    question: "Will Real Madrid win the UEFA Champions League 2025/26?",
    description: "Resolves YES if Real Madrid CF wins the UEFA Champions League final in the 2025/26 season.",
    category: "Sports",
    daysFromNow: 180,
    imageUrl: "",
  },
  {
    question: "Will any football team break the $2 billion club valuation in 2025?",
    description: "Resolves YES if any association football club is officially valued at or above $2 billion USD in a verified sale or valuation report before December 31, 2025.",
    category: "Sports",
    daysFromNow: 100,
    imageUrl: "",
  },
];

// ─── Handler ──────────────────────────────────────────────────────

const FACTORY_ABI = [
  {
    type: "function",
    name: "createMarket",
    inputs: [
      { name: "_question",    type: "string"  },
      { name: "_description", type: "string"  },
      { name: "_imageUrl",    type: "string"  },
      { name: "_category",    type: "string"  },
      { name: "_endTime",     type: "uint256" },
    ],
    outputs: [{ name: "market", type: "address" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getMarkets",
    inputs: [
      { name: "offset", type: "uint256" },
      { name: "limit",  type: "uint256" },
    ],
    outputs: [{ name: "markets", type: "address[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalMarkets",
    inputs:  [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

const MARKET_ABI = [
  {
    type: "function",
    name: "question",
    inputs:  [],
    outputs: [{ type: "string" }],
    stateMutability: "view",
  },
] as const;

export async function POST(req: NextRequest) {
  // ── 1. Verify cron secret ──────────────────────────────────────
  const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 2. Load bot wallet ────────────────────────────────────────
  const botKey = process.env.BOT_PRIVATE_KEY;
  if (!botKey) {
    return NextResponse.json({ error: "BOT_PRIVATE_KEY not set" }, { status: 500 });
  }

  const factoryAddress = (process.env.NEXT_PUBLIC_FACTORY_ADDRESS ??
    "0x2f312fFEF4Acc6B91E036Bc5945da87bf0049d7b") as `0x${string}`;

  const account = privateKeyToAccount(botKey as `0x${string}`);

  const publicClient = createPublicClient({
    chain:     megaETH,
    transport: http(process.env.NEXT_PUBLIC_RPC_URL ?? "https://mainnet.megaeth.com/rpc"),
  });

  const walletClient = createWalletClient({
    account,
    chain:     megaETH,
    transport: http(process.env.NEXT_PUBLIC_RPC_URL ?? "https://mainnet.megaeth.com/rpc"),
  });

  // ── 3. Get existing market questions ─────────────────────────
  const total = await publicClient.readContract({
    address:      factoryAddress,
    abi:          FACTORY_ABI,
    functionName: "totalMarkets",
  });

  const existingQuestions = new Set<string>();
  if (total > 0n) {
    const addresses = await publicClient.readContract({
      address:      factoryAddress,
      abi:          FACTORY_ABI,
      functionName: "getMarkets",
      args:         [0n, total > 100n ? 100n : total],
    }) as `0x${string}`[];

    // Read questions in parallel
    const questions = await publicClient.multicall({
      contracts: addresses.map((a) => ({
        address: a, abi: MARKET_ABI, functionName: "question" as const,
      })),
      allowFailure: true,
    });
    questions.forEach((r) => {
      if (r.status === "success") existingQuestions.add(r.result as string);
    });
  }

  // ── 4. Pick markets to create (max 3 per run) ─────────────────
  const toCreate = MARKET_TEMPLATES
    .filter((t) => !existingQuestions.has(t.question))
    .slice(0, 3);

  if (toCreate.length === 0) {
    return NextResponse.json({
      status:   "ok",
      created:  0,
      message:  "All template markets already exist on-chain.",
    });
  }

  // ── 5. Create each market ────────────────────────────────────
  const created: string[] = [];
  const errors:  string[] = [];

  for (const tpl of toCreate) {
    const endTime = BigInt(
      Math.floor(Date.now() / 1000) + tpl.daysFromNow * 86_400
    );
    try {
      const hash = await walletClient.writeContract({
        address:      factoryAddress,
        abi:          FACTORY_ABI,
        functionName: "createMarket",
        args: [tpl.question, tpl.description, tpl.imageUrl, tpl.category, endTime],
      });
      created.push(`${tpl.question.slice(0, 60)}… [tx: ${hash}]`);

      // Small delay to avoid nonce issues
      await new Promise((r) => setTimeout(r, 1_500));
    } catch (err) {
      errors.push(`${tpl.question.slice(0, 40)}: ${(err as Error).message.slice(0, 80)}`);
    }
  }

  return NextResponse.json({
    status:  "ok",
    created: created.length,
    markets: created,
    errors,
  });
}

// Vercel cron calls GET too — forward to POST with secret
export async function GET(req: NextRequest) {
  return POST(req);
}
