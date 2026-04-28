import { formatUnits, parseUnits } from "viem";
import { formatDistanceToNowStrict, format } from "date-fns";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { USDM_DECIMALS, CREATOR_FEE_BPS, FEE_DENOMINATOR } from "./contracts";

// Re-export so pages can import addrUrl / txUrl from either utils or contracts
export { txUrl, addrUrl } from "./contracts";

// ── Tailwind class merger ─────────────────────────────────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── USDM formatting ───────────────────────────────────────────────

/** Raw bigint (18 dec) → "1,234.56 USDM" */
export function fmtUSDM(raw: bigint, digits = 2): string {
  if (raw === 0n) return "0 USDM";
  const val = parseFloat(formatUnits(raw, USDM_DECIMALS));
  if (val < 0.01) return "<0.01 USDM";
  return `${val.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} USDM`;
}

/** "$1.2K", "$3.4M" */
export function fmtUSDMCompact(raw: bigint): string {
  const val = parseFloat(formatUnits(raw, USDM_DECIMALS));
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000)     return `$${(val / 1_000).toFixed(1)}K`;
  if (val >= 1)         return `$${val.toFixed(2)}`;
  if (val > 0)          return `<$1`;
  return "$0";
}

/** Parse string USDM amount to raw bigint. Returns 0n on error. */
export function parseUSDMSafe(value: string): bigint {
  if (!value || isNaN(Number(value))) return 0n;
  try { return parseUnits(value as `${number}`, USDM_DECIMALS); }
  catch { return 0n; }
}

// ── Probability ───────────────────────────────────────────────────
export function bpsToPercent(bps: bigint | number): number {
  return Number(bps) / 100;
}

export function fmtProb(pct: number): string {
  return `${pct.toFixed(1)}%`;
}

// ── Time ─────────────────────────────────────────────────────────
export function fmtTimeLeft(seconds: number): string {
  if (seconds <= 0) return "Expired";
  return formatDistanceToNowStrict(new Date(Date.now() + seconds * 1_000));
}

export function fmtEndDate(unix: number): string {
  return format(new Date(unix * 1000), "MMM d, yyyy HH:mm");
}

// ── Address ──────────────────────────────────────────────────────
export function shortenAddress(addr: string, chars = 4): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, chars + 2)}...${addr.slice(-chars)}`;
}

// ── Fee calculation ───────────────────────────────────────────────
export function calcFees(betRaw: bigint, platformFeeBps: number) {
  const pFee = (betRaw * BigInt(platformFeeBps)) / BigInt(FEE_DENOMINATOR);
  const cFee = (betRaw * BigInt(CREATOR_FEE_BPS)) / BigInt(FEE_DENOMINATOR);
  const net  = betRaw - pFee - cFee;
  return { platformFee: pFee, creatorFee: cFee, totalFee: pFee + cFee, net };
}

/** Estimate payout for buying `betRaw` USDM on one side. */
export function estimatePayout(
  betRaw: bigint,
  platformFeeBps: number,
  currentPool: bigint,
  oppositePool: bigint,
) {
  if (betRaw === 0n) return { shares: 0n, payout: 0n, multiplier: 1 };
  const { net } = calcFees(betRaw, platformFeeBps);
  const newPool = currentPool + net;
  const total   = currentPool + oppositePool + net;
  const payout  = newPool > 0n ? (net * total) / newPool : 0n;
  const mult    = betRaw > 0n ? Number((payout * 10_000n) / betRaw) / 10_000 : 1;
  return { shares: net, payout, multiplier: mult };
}
