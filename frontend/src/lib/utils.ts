import { formatUnits, parseUnits } from "viem";
import { formatDistanceToNowStrict, format } from "date-fns";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { USDM_DECIMALS, CREATOR_FEE_BPS, FEE_DENOMINATOR } from "./contracts";

export { txUrl, addrUrl } from "./contracts";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmtUSDM(raw: bigint, digits = 2): string {
  if (raw === 0n) return "0 USDM";
  const val = parseFloat(formatUnits(raw, USDM_DECIMALS));
  if (val < 0.01) return "<0.01 USDM";
  return `${val.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })} USDM`;
}

export function fmtUSDMCompact(raw: bigint): string {
  const val = parseFloat(formatUnits(raw, USDM_DECIMALS));
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000)     return `$${(val / 1_000).toFixed(1)}K`;
  if (val >= 1)         return `$${val.toFixed(2)}`;
  if (val > 0)          return `<$1`;
  return "$0";
}

export function parseUSDMSafe(value: string): bigint {
  if (!value || isNaN(Number(value))) return 0n;
  try { return parseUnits(value as `${number}`, USDM_DECIMALS); }
  catch { return 0n; }
}

export function bpsToPercent(bps: bigint | number): number { return Number(bps) / 100; }
export function fmtProb(pct: number): string { return `${pct.toFixed(1)}%`; }

export function fmtTimeLeft(seconds: number): string {
  if (seconds <= 0) return "EXPIRED";
  return formatDistanceToNowStrict(new Date(Date.now() + seconds * 1_000)).toUpperCase();
}

export function fmtEndDate(unix: number): string {
  return format(new Date(unix * 1000), "dd MMM yyyy HH:mm").toUpperCase();
}

export function shortenAddress(addr: string, chars = 4): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, chars + 2)}...${addr.slice(-chars)}`;
}

export function calcFees(betRaw: bigint, platformFeeBps: number) {
  const pFee = (betRaw * BigInt(platformFeeBps)) / BigInt(FEE_DENOMINATOR);
  const cFee = (betRaw * BigInt(CREATOR_FEE_BPS)) / BigInt(FEE_DENOMINATOR);
  return { platformFee: pFee, creatorFee: cFee, totalFee: pFee + cFee, net: betRaw - pFee - cFee };
}

export function estimatePayout(
  betRaw: bigint, platformFeeBps: number,
  currentPool: bigint, oppositePool: bigint,
) {
  if (betRaw === 0n) return { shares: 0n, payout: 0n, multiplier: 1 };
  const { net } = calcFees(betRaw, platformFeeBps);
  const newPool = currentPool + net;
  const total   = currentPool + oppositePool + net;
  const payout  = newPool > 0n ? (net * total) / newPool : 0n;
  const mult    = betRaw > 0n ? Number((payout * 10_000n) / betRaw) / 10_000 : 1;
  return { shares: net, payout, multiplier: mult };
}
