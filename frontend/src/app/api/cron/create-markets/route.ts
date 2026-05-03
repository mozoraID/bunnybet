import { NextRequest, NextResponse } from "next/server";
import { createWalletClient, createPublicClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";

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
  { type: "function", name: "getMarkets", inputs: [{ name: "offset", type: "uint256" }, { name: "limit", type: "uint256" }], outputs: [{ name: "markets", type: "address[]" }], stateMutability: "view" },
  { type: "function", name: "totalMarkets", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
] as const;

const QUESTION_ABI = [
  { type: "function", name: "question", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" },
] as const;

// Category mapping from Polymarket tags
const TAG_MAP: Record<string, string> = {
  crypto: "Crypto", bitcoin: "Crypto", ethereum: "Crypto",
  politics: "Politics", elections: "Politics", world: "Politics",
  sports: "Sports", nba: "Sports", nfl: "Sports", soccer: "Sports",
  technology: "Tech", science: "Tech",
  business: "Finance", finance: "Finance",
  entertainment: "Entertainment",
};

async function fetchPolymarketTrending(limit = 30): Promise<{
  question: string; description: string; imageUrl: string;
  category: string; endDate: string;
}[]> {
  // Use simpler URL — avoid param mismatches
  const url = `https://gamma-api.polymarket.com/markets?active=true&closed=false&archived=false&limit=${limit}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) throw new Error(`Polymarket API ${res.status}: ${await res.text().catch(() => "")}`);
  const data = await res.json();

  // data should be an array
  const markets = Array.isArray(data) ? data : (data.markets ?? data.data ?? []);

  const results: { question: string; description: string; imageUrl: string; category: string; endDate: string }[] = [];

  for (const m of markets) {
    // Skip restricted markets
    if (m.restricted === true) continue;

    // Get question from multiple possible fields
    const question = m.question || m.title || "";
    if (!question || question.length < 5) continue;

    // Check if binary (2 outcomes) — be lenient about case/format
    let isBinary = false;
    try {
      const outcomes: string[] = typeof m.outcomes === "string"
        ? JSON.parse(m.outcomes)
        : Array.isArray(m.outcomes) ? m.outcomes : [];

      if (outcomes.length === 2) {
        const lower = outcomes.map((o: string) => String(o).toLowerCase());
        isBinary = lower.includes("yes") && lower.includes("no");
        // Also accept common variants
        if (!isBinary) isBinary = lower.some((o: string) => o.startsWith("yes")) && lower.some((o: string) => o.startsWith("no"));
        // If no yes/no, still accept 2-outcome binary markets
        if (!isBinary) isBinary = true; // just require exactly 2 outcomes
      }
    } catch {
      isBinary = false;
    }
    if (!isBinary) continue;

    // Map category from tags
    let category = "Other";
    const tags: { label?: string; slug?: string }[] = Array.isArray(m.tags) ? m.tags : [];
    for (const tag of tags) {
      const slug  = (tag.slug  ?? "").toLowerCase();
      const label = (tag.label ?? "").toLowerCase();
      const mapped = TAG_MAP[slug] ?? TAG_MAP[label];
      if (mapped) { category = mapped; break; }
    }

    // Get image
    const imageUrl = m.image || m.icon || m.featuredImage || "";

    // End date
    const endDate = m.endDate || m.end_date_iso || m.endDateIso || "";

    results.push({ question, description: m.description ?? "", imageUrl, category, endDate });
  }

  return results;
}

export async function GET(req: NextRequest)  { return run(req); }
export async function POST(req: NextRequest) { return run(req); }

async function run(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (!process.env.CRON_SECRET)           return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const botKey = process.env.BOT_PRIVATE_KEY;
  if (!botKey) return NextResponse.json({ error: "BOT_PRIVATE_KEY not set" }, { status: 500 });

  const factory = (process.env.NEXT_PUBLIC_FACTORY_ADDRESS ?? "0x2f312fFEF4Acc6B91E036Bc5945da87bf0049d7b") as `0x${string}`;
  const rpc     = process.env.NEXT_PUBLIC_RPC_URL ?? "https://mainnet.megaeth.com/rpc";

  let account;
  try { account = privateKeyToAccount(botKey as `0x${string}`); }
  catch { return NextResponse.json({ error: "Invalid BOT_PRIVATE_KEY" }, { status: 500 }); }

  const pub = createPublicClient({ chain: megaETH, transport: http(rpc) });
  const wal = createWalletClient({ account, chain: megaETH, transport: http(rpc) });

  // Get existing questions on-chain
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

  // Fetch from Polymarket
  let candidates: { question: string; description: string; imageUrl: string; category: string; endDate: string }[] = [];
  let source = "polymarket";
  let fetchDebug = "";

  try {
    candidates = await fetchPolymarketTrending(30);
    fetchDebug = `fetched ${candidates.length} binary markets from Polymarket`;
  } catch (e) {
    console.error("[cron] Polymarket API failed:", e);
    source = "fallback";
    fetchDebug = `Polymarket failed: ${e instanceof Error ? e.message : "unknown"}`;
    candidates = [
      { question: "Will Bitcoin (BTC) reach $120,000 USD by end of 2025?",  description: "Resolves YES if BTC/USD reaches $120,000 before Dec 31 2025.", imageUrl: "", category: "Crypto",  endDate: new Date(Date.now() + 120 * 86_400_000).toISOString() },
      { question: "Will Ethereum (ETH) reach $5,000 USD by end of 2025?",   description: "Resolves YES if ETH/USD reaches $5,000 before Dec 31 2025.",   imageUrl: "", category: "Crypto",  endDate: new Date(Date.now() + 120 * 86_400_000).toISOString() },
      { question: "Will OpenAI release GPT-5 publicly in 2025?",            description: "Resolves YES if OpenAI publicly releases GPT-5 before Dec 31 2025.", imageUrl: "", category: "Tech", endDate: new Date(Date.now() + 100 * 86_400_000).toISOString() },
      { question: "Will the US Federal Reserve cut rates in Q1 2026?",      description: "Resolves YES if Fed cuts rates at Jan or Mar 2026 FOMC meeting.", imageUrl: "", category: "Finance", endDate: new Date(Date.now() + 90 * 86_400_000).toISOString() },
      { question: "Will Real Madrid win UEFA Champions League 2025/26?",    description: "Resolves YES if Real Madrid wins UCL final 2025/26 season.", imageUrl: "", category: "Sports", endDate: new Date(Date.now() + 180 * 86_400_000).toISOString() },
    ];
  }

  // Filter out existing — case-insensitive
  const todo = candidates
    .filter((c) => !existing.has(c.question.toLowerCase()))
    .slice(0, 5);

  if (!todo.length) {
    return NextResponse.json({
      status: "ok", created: 0, source,
      debug: fetchDebug,
      existingCount: existing.size,
      candidateCount: candidates.length,
      message: candidates.length === 0
        ? "No binary markets found from Polymarket — try again later"
        : "All trending markets already exist on-chain.",
    });
  }

  // Create markets
  const created: string[] = [];
  const errors:  string[] = [];

  for (const m of todo) {
    let endTime: bigint;
    try {
      const ts = m.endDate ? Math.max(new Date(m.endDate).getTime(), Date.now() + 2 * 3_600_000) : Date.now() + 90 * 86_400_000;
      endTime  = BigInt(Math.floor(ts / 1000));
    } catch {
      endTime = BigInt(Math.floor(Date.now() / 1000) + 90 * 86_400);
    }
    try {
      const hash = await wal.writeContract({
        address: factory, abi: FACTORY_ABI, functionName: "createMarket",
        args: [m.question, m.description, m.imageUrl, m.category, endTime],
      });
      created.push(`${m.question.slice(0, 55)}... [${hash.slice(0, 10)}]`);
      await new Promise((r) => setTimeout(r, 2_000));
    } catch (e) {
      errors.push(`${m.question.slice(0, 40)}: ${e instanceof Error ? e.message.slice(0, 80) : "error"}`);
    }
  }

  return NextResponse.json({
    status: "ok", source, debug: fetchDebug,
    created: created.length, botAddress: account.address,
    markets: created, errors,
  });
}
