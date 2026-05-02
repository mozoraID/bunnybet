/**
 * GET|POST /api/cron/create-markets
 *
 * Fetches LIVE trending markets from Polymarket's Gamma API,
 * then creates matching markets on BunnyBet (MegaETH + USDM).
 *
 * Flow:
 * 1. Fetch top active markets from gamma-api.polymarket.com
 * 2. Filter to binary Yes/No markets only (BunnyBet is binary)
 * 3. Skip questions already on-chain
 * 4. Create up to 5 new markets per run via bot wallet
 *
 * Cron: daily 08:00 UTC (vercel.json)
 * Security: protected by CRON_SECRET header or ?secret= param
 */

import { NextRequest, NextResponse } from "next/server";
import { createWalletClient, createPublicClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// ── MegaETH chain (inline — wagmi.ts is "use client") ─────────────────────────
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

// ── Factory ABI (inline) ───────────────────────────────────────────────────────
const FACTORY_ABI = [
  { type: "function", name: "createMarket", inputs: [{ name: "_question", type: "string" }, { name: "_description", type: "string" }, { name: "_imageUrl", type: "string" }, { name: "_category", type: "string" }, { name: "_endTime", type: "uint256" }], outputs: [{ name: "market", type: "address" }], stateMutability: "nonpayable" },
  { type: "function", name: "getMarkets",   inputs: [{ name: "offset", type: "uint256" }, { name: "limit", type: "uint256" }], outputs: [{ name: "markets", type: "address[]" }], stateMutability: "view" },
  { type: "function", name: "totalMarkets", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
] as const;

const QUESTION_ABI = [
  { type: "function", name: "question", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" },
] as const;

// ── Polymarket category → BunnyBet category mapping ───────────────────────────
const TAG_MAP: Record<string, string> = {
  crypto:        "Crypto",
  politics:      "Politics",
  sports:        "Sports",
  technology:    "Tech",
  business:      "Finance",
  finance:       "Finance",
  entertainment: "Entertainment",
  science:       "Tech",
  world:         "Politics",
  elections:     "Politics",
  nba:           "Sports",
  nfl:           "Sports",
  soccer:        "Sports",
  bitcoin:       "Crypto",
  ethereum:      "Crypto",
};

// ── Fallback templates (used if Polymarket API is down) ───────────────────────
const FALLBACK_TEMPLATES = [
  { question: "Will Bitcoin (BTC) reach $120,000 USD by end of 2025?",  description: "Resolves YES if BTC/USD reaches $120,000 before Dec 31 2025.", category: "Crypto",  days: 120 },
  { question: "Will Ethereum (ETH) reach $5,000 USD by end of 2025?",   description: "Resolves YES if ETH/USD reaches $5,000 before Dec 31 2025.",   category: "Crypto",  days: 120 },
  { question: "Will MegaETH TVL exceed $500M by Q2 2026?",              description: "Resolves YES if DeFiLlama reports MegaETH TVL >= $500M before June 30 2026.", category: "Crypto", days: 60 },
  { question: "Will OpenAI release GPT-5 publicly in 2025?",            description: "Resolves YES if OpenAI publicly releases GPT-5 before Dec 31 2025.",         category: "Tech",   days: 100 },
  { question: "Will the US Federal Reserve cut rates in Q1 2026?",      description: "Resolves YES if Fed cuts rates at Jan or Mar 2026 FOMC meeting.",              category: "Finance", days: 90 },
];

// ── Polymarket Gamma API types ─────────────────────────────────────────────────
interface PolymarketMarket {
  question:    string;
  description: string;
  image:       string;
  icon:        string;
  endDate:     string;        // ISO date string
  volume:      string;        // lifetime volume USD
  volume24hr:  number;
  active:      boolean;
  closed:      boolean;
  archived:    boolean;
  restricted:  boolean;
  tags:        { label: string; slug: string }[];
  outcomes:    string;        // JSON array: ["Yes","No"] or ["A","B","C"]
}

// ── Fetch trending markets from Polymarket ─────────────────────────────────────
async function fetchPolymarketTrending(limit = 20): Promise<{
  question: string;
  description: string;
  imageUrl: string;
  category: string;
  endDate: string;
}[]> {
  const url = "https://gamma-api.polymarket.com/markets?" + new URLSearchParams({
    active:          "true",
    closed:          "false",
    archived:        "false",
    order:           "volume24hr",
    ascending:       "false",
    limit:           String(limit),
  });

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next:    { revalidate: 0 },   // always fresh
    signal:  AbortSignal.timeout(8_000),
  });

  if (!res.ok) throw new Error(`Polymarket API ${res.status}`);

  const data = await res.json() as PolymarketMarket[];

  return data
    .filter((m) => {
      // Only binary Yes/No markets
      try {
        const outcomes = JSON.parse(m.outcomes ?? "[]") as string[];
        return outcomes.length === 2 &&
          outcomes.some((o) => o.toLowerCase() === "yes") &&
          outcomes.some((o) => o.toLowerCase() === "no");
      } catch { return false; }
    })
    .filter((m) => !m.restricted)
    .map((m) => {
      // Map Polymarket tags to BunnyBet categories
      let category = "Other";
      for (const tag of (m.tags ?? [])) {
        const mapped = TAG_MAP[tag.slug?.toLowerCase() ?? ""] ?? TAG_MAP[tag.label?.toLowerCase() ?? ""];
        if (mapped) { category = mapped; break; }
      }

      // Pick best image
      const imageUrl = m.image || m.icon || "";

      return {
        question:    m.question,
        description: m.description ?? "",
        imageUrl,
        category,
        endDate:     m.endDate,
      };
    });
}

// ── Main handler ───────────────────────────────────────────────────────────────
export async function GET(req: NextRequest)  { return run(req); }
export async function POST(req: NextRequest) { return run(req); }

async function run(req: NextRequest) {
  // 1. Auth
  const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (!process.env.CRON_SECRET)            return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  if (secret !== process.env.CRON_SECRET)  return NextResponse.json({ error: "Unauthorized" },              { status: 401 });

  // 2. Bot wallet
  const botKey = process.env.BOT_PRIVATE_KEY;
  if (!botKey) return NextResponse.json({ error: "BOT_PRIVATE_KEY not set" }, { status: 500 });

  const factory = (process.env.NEXT_PUBLIC_FACTORY_ADDRESS ?? "0x2f312fFEF4Acc6B91E036Bc5945da87bf0049d7b") as `0x${string}`;
  const rpc     = process.env.NEXT_PUBLIC_RPC_URL ?? "https://mainnet.megaeth.com/rpc";

  let account;
  try { account = privateKeyToAccount(botKey as `0x${string}`); }
  catch { return NextResponse.json({ error: "Invalid BOT_PRIVATE_KEY" }, { status: 500 }); }

  const pub = createPublicClient({ chain: megaETH, transport: http(rpc) });
  const wal = createWalletClient({ account, chain: megaETH, transport: http(rpc) });

  // 3. Get existing questions on-chain
  const existing = new Set<string>();
  try {
    const total = await pub.readContract({ address: factory, abi: FACTORY_ABI, functionName: "totalMarkets" }) as bigint;
    if (total > 0n) {
      const addrs = await pub.readContract({
        address: factory, abi: FACTORY_ABI, functionName: "getMarkets",
        args: [0n, total > 100n ? 100n : total],
      }) as `0x${string}`[];

      const qs = await Promise.all(addrs.map(async (a) => {
        try { return await pub.readContract({ address: a, abi: QUESTION_ABI, functionName: "question" }) as string; }
        catch { return ""; }
      }));
      qs.forEach((q) => { if (q) existing.add(q.toLowerCase()); });
    }
  } catch (e) { console.error("[cron] fetch existing:", e); }

  // 4. Fetch from Polymarket (fallback to templates if API down)
  let candidates: { question: string; description: string; imageUrl: string; category: string; endDate: string }[] = [];
  let source = "polymarket";

  try {
    candidates = await fetchPolymarketTrending(30);
    console.log(`[cron] fetched ${candidates.length} markets from Polymarket`);
  } catch (e) {
    console.error("[cron] Polymarket API failed, using fallback:", e);
    source = "fallback";
    candidates = FALLBACK_TEMPLATES.map((t) => ({
      question:    t.question,
      description: t.description,
      imageUrl:    "",
      category:    t.category,
      endDate:     new Date(Date.now() + t.days * 86_400_000).toISOString(),
    }));
  }

  // 5. Filter out existing markets (case-insensitive)
  const todo = candidates
    .filter((c) => !existing.has(c.question.toLowerCase()))
    .slice(0, 5);   // max 5 per run

  if (!todo.length) {
    return NextResponse.json({ status: "ok", created: 0, source, message: "All trending markets already exist on-chain." });
  }

  // 6. Create markets on-chain
  const created: string[] = [];
  const errors:  string[] = [];

  for (const m of todo) {
    // Parse endDate from Polymarket, ensure it's at least 2 hours from now
    let endTime: bigint;
    try {
      const parsed = new Date(m.endDate).getTime();
      const minEnd = Date.now() + 2 * 3_600_000;
      const ts = Math.max(parsed, minEnd);
      endTime  = BigInt(Math.floor(ts / 1000));
    } catch {
      endTime = BigInt(Math.floor(Date.now() / 1000) + 90 * 86_400);
    }

    try {
      const hash = await wal.writeContract({
        address:      factory,
        abi:          FACTORY_ABI,
        functionName: "createMarket",
        args: [m.question, m.description, m.imageUrl, m.category, endTime],
      });
      created.push(`${m.question.slice(0, 55)}... [${hash.slice(0, 10)}]`);
      await new Promise((r) => setTimeout(r, 2_000)); // 2s between txs
    } catch (e) {
      errors.push(`${m.question.slice(0, 40)}: ${e instanceof Error ? e.message.slice(0, 80) : "error"}`);
    }
  }

  return NextResponse.json({
    status:     "ok",
    source,
    created:    created.length,
    botAddress: account.address,
    markets:    created,
    errors,
  });
}
