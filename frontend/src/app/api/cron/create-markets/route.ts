/**
 * GET|POST /api/cron/create-markets
 * Fixed: define megaETH inline — cannot import from wagmi.ts ("use client")
 */
import { NextRequest, NextResponse } from "next/server";
import { createWalletClient, createPublicClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// Define chain inline — wagmi.ts has "use client" so can't be imported in API route
const megaETH = defineChain({
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
  },
  testnet: false,
});

const FACTORY_ABI = [
  { type: "function", name: "createMarket", inputs: [{ name: "_question", type: "string" }, { name: "_description", type: "string" }, { name: "_imageUrl", type: "string" }, { name: "_category", type: "string" }, { name: "_endTime", type: "uint256" }], outputs: [{ name: "market", type: "address" }], stateMutability: "nonpayable" },
  { type: "function", name: "getMarkets",   inputs: [{ name: "offset", type: "uint256" }, { name: "limit", type: "uint256" }], outputs: [{ name: "markets", type: "address[]" }], stateMutability: "view" },
  { type: "function", name: "totalMarkets", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
] as const;

const QUESTION_ABI = [
  { type: "function", name: "question", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" },
] as const;

const TEMPLATES = [
  { question: "Will Bitcoin (BTC) reach $120,000 USD by end of 2025?",    description: "Resolves YES if BTC/USD price on CoinGecko reaches or exceeds $120,000 before Dec 31, 2025 23:59 UTC.", category: "Crypto",  days: 120 },
  { question: "Will Ethereum (ETH) reach $5,000 USD by end of 2025?",     description: "Resolves YES if ETH/USD price on CoinGecko reaches or exceeds $5,000 before Dec 31, 2025 23:59 UTC.",   category: "Crypto",  days: 120 },
  { question: "Will MegaETH TVL exceed $500M by Q2 2026?",                description: "Resolves YES if DeFiLlama reports MegaETH TVL >= $500M at any point before June 30, 2026.",              category: "Crypto",  days: 60  },
  { question: "Will Solana (SOL) reach $300 USD by end of 2025?",         description: "Resolves YES if SOL/USD price on CoinGecko reaches or exceeds $300 before Dec 31, 2025.",                 category: "Crypto",  days: 120 },
  { question: "Will the total crypto market cap exceed $5 trillion in 2025?", description: "Resolves YES if CoinGecko total market cap shows >= $5T at any point before Dec 31, 2025.",           category: "Crypto",  days: 120 },
  { question: "Will OpenAI release GPT-5 publicly in 2025?",              description: "Resolves YES if OpenAI publicly releases a model officially named GPT-5 before Dec 31, 2025.",            category: "Tech",    days: 100 },
  { question: "Will Apple release an AI-native iPhone model in 2025?",    description: "Resolves YES if Apple ships an iPhone marketed around on-device AI features before Dec 31, 2025.",         category: "Tech",    days: 100 },
  { question: "Will the US Federal Reserve cut rates in Q1 2026?",        description: "Resolves YES if the Fed announces a rate cut at its Jan or Mar 2026 FOMC meeting.",                       category: "Finance", days: 90  },
  { question: "Will NASDAQ 100 reach 25,000 by end of 2025?",             description: "Resolves YES if NDX closes at or above 25,000 at any session before Dec 31, 2025.",                       category: "Finance", days: 100 },
  { question: "Will BTC ETF total AUM exceed $100 billion in 2025?",      description: "Resolves YES if total AUM across all US Bitcoin Spot ETFs exceeds $100B before Dec 31, 2025.",            category: "Finance", days: 90  },
  { question: "Will Real Madrid win the UEFA Champions League 2025/26?",  description: "Resolves YES if Real Madrid wins the UEFA Champions League final in the 2025/26 season.",                  category: "Sports",  days: 180 },
  { question: "Will Chainlink (LINK) reach $30 USD by end of 2025?",      description: "Resolves YES if LINK/USD on CoinGecko reaches or exceeds $30 before Dec 31, 2025.",                       category: "Crypto",  days: 120 },
];

export async function GET(req: NextRequest)  { return run(req); }
export async function POST(req: NextRequest) { return run(req); }

async function run(req: NextRequest) {
  // Auth
  const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (!process.env.CRON_SECRET)        return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ error: "Unauthorized" },            { status: 401 });

  // Bot wallet
  const botKey = process.env.BOT_PRIVATE_KEY;
  if (!botKey) return NextResponse.json({ error: "BOT_PRIVATE_KEY not set" }, { status: 500 });

  const factory = (process.env.NEXT_PUBLIC_FACTORY_ADDRESS ?? "0x2f312fFEF4Acc6B91E036Bc5945da87bf0049d7b") as `0x${string}`;
  const rpc     = process.env.NEXT_PUBLIC_RPC_URL ?? "https://mainnet.megaeth.com/rpc";

  let account;
  try { account = privateKeyToAccount(botKey as `0x${string}`); }
  catch { return NextResponse.json({ error: "Invalid BOT_PRIVATE_KEY" }, { status: 500 }); }

  const pub = createPublicClient({ chain: megaETH, transport: http(rpc) });
  const wal = createWalletClient({ account, chain: megaETH, transport: http(rpc) });

  // Get existing questions
  const existing = new Set<string>();
  try {
    const total = await pub.readContract({ address: factory, abi: FACTORY_ABI, functionName: "totalMarkets" });
    if (total > 0n) {
      const addrs = await pub.readContract({ address: factory, abi: FACTORY_ABI, functionName: "getMarkets", args: [0n, total > 100n ? 100n : total] }) as `0x${string}`[];
      const qs = await pub.multicall({ contracts: addrs.map(a => ({ address: a, abi: QUESTION_ABI, functionName: "question" as const })), allowFailure: true });
      qs.forEach(r => { if (r.status === "success") existing.add(r.result as string); });
    }
  } catch (e) { console.error("fetch existing:", e); }

  // Pick up to 3 new markets
  const todo = TEMPLATES.filter(t => !existing.has(t.question)).slice(0, 3);
  if (!todo.length) return NextResponse.json({ status: "ok", created: 0, message: "All markets already exist." });

  const created: string[] = [];
  const errors:  string[] = [];

  for (const t of todo) {
    const endTime = BigInt(Math.floor(Date.now() / 1000) + t.days * 86_400);
    try {
      const hash = await wal.writeContract({
        address: factory, abi: FACTORY_ABI, functionName: "createMarket",
        args: [t.question, t.description, "", t.category, endTime],
      });
      created.push(`${t.question.slice(0, 55)}... [${hash.slice(0, 12)}]`);
      await new Promise(r => setTimeout(r, 2_000));
    } catch (e) {
      errors.push(`${t.question.slice(0, 40)}: ${e instanceof Error ? e.message.slice(0, 80) : "unknown"}`);
    }
  }

  return NextResponse.json({ status: "ok", created: created.length, botAddress: account.address, markets: created, errors });
}
