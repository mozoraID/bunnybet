import { NextRequest, NextResponse } from "next/server";

export const revalidate = 60;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const category = searchParams.get("category") ?? "";
  const limit    = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);
  const offset   = parseInt(searchParams.get("offset") ?? "0");

  const params: Record<string, string> = {
    active: "true", closed: "false", archived: "false",
    limit: String(limit), offset: String(offset),
  };

  const CAT_TAG: Record<string, string> = {
    crypto: "cryptocurrency", politics: "politics", sports: "sports",
    tech: "technology", finance: "business", entertainment: "entertainment",
  };
  if (category && CAT_TAG[category.toLowerCase()]) {
    params.tag_slug = CAT_TAG[category.toLowerCase()];
  }

  const url = "https://gamma-api.polymarket.com/markets?" + new URLSearchParams(params);

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new Error(`Polymarket API ${res.status}`);
    const raw = await res.json();
    const markets = Array.isArray(raw) ? raw : (raw.markets ?? raw.data ?? []);

    const normalized = markets
      .filter((m: Record<string, unknown>) => !m.restricted && m.question)
      .map((m: Record<string, unknown>) => {
        let outcomes: string[] = [];
        let outcomePrices: number[] = [];
        try {
          outcomes = typeof m.outcomes === "string" ? JSON.parse(m.outcomes as string) : (Array.isArray(m.outcomes) ? m.outcomes : []);
        } catch { outcomes = ["Yes", "No"]; }
        try {
          const rawPrices = typeof m.outcomePrices === "string" ? JSON.parse(m.outcomePrices as string) : (Array.isArray(m.outcomePrices) ? m.outcomePrices : []);
          outcomePrices = rawPrices.map((p: string | number) => Math.round(parseFloat(String(p)) * 100));
        } catch { outcomePrices = outcomes.map(() => Math.round(100 / Math.max(outcomes.length, 1))); }

        const tags = Array.isArray(m.tags) ? m.tags as {label?:string;slug?:string}[] : [];
        let category = "Other";
        const tagMap: Record<string, string> = { crypto:"Crypto", cryptocurrency:"Crypto", bitcoin:"Crypto", politics:"Politics", elections:"Politics", sports:"Sports", technology:"Tech", business:"Finance", finance:"Finance", entertainment:"Entertainment" };
        for (const t of tags) {
          const key = ((t.slug ?? t.label) ?? "").toLowerCase();
          if (tagMap[key]) { category = tagMap[key]; break; }
        }

        return {
          id:           String(m.id ?? m.conditionId ?? ""),
          question:     String(m.question ?? ""),
          description:  String(m.description ?? ""),
          image:        String(m.image ?? m.icon ?? ""),
          endDate:      String(m.endDate ?? ""),
          volume:       parseFloat(String(m.volume ?? 0)),
          volume24h:    parseFloat(String(m.volume24hr ?? 0)),
          liquidity:    parseFloat(String(m.liquidity ?? 0)),
          category,
          outcomes,
          outcomePrices,
          polymarketUrl: m.slug ? `https://polymarket.com/event/${m.slug}` : "https://polymarket.com",
        };
      })
      .filter((m: { question: string }) => m.question.length > 5);

    return NextResponse.json({ markets: normalized, total: normalized.length });
  } catch (e) {
    return NextResponse.json({ markets: [], total: 0, error: e instanceof Error ? e.message : "unknown" });
  }
}
