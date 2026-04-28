"use client";
import { cn, fmtProb } from "@/lib/utils";

interface ProbabilityBarProps {
  yesProb:    number;
  noProb:     number;
  size?:      "sm" | "md" | "lg";
  showLabels?: boolean;
  className?: string;
}

export function ProbabilityBar({ yesProb, noProb, size = "md", showLabels = true, className }: ProbabilityBarProps) {
  const h = { sm: "h-2", md: "h-3", lg: "h-5" }[size];
  const t = { sm: "text-xs", md: "text-xs", lg: "text-sm" }[size];

  return (
    <div className={cn("w-full", className)}>
      {showLabels && (
        <div className="flex justify-between mb-1.5">
          <span className={cn("font-bold tabular-nums text-cyan", t)}>YES {fmtProb(yesProb)}</span>
          <span className={cn("font-bold tabular-nums text-pink", t)}>NO {fmtProb(noProb)}</span>
        </div>
      )}
      <div className={cn("w-full rounded-full overflow-hidden bg-surface-3 flex", h)}>
        <div className="h-full rounded-l-full transition-all duration-700"
          style={{ width: `${yesProb}%`, background: "linear-gradient(90deg,#00c4cc,#00f5ff)", boxShadow: yesProb > 5 ? "2px 0 8px rgba(0,245,255,0.4)" : "none" }} />
        <div className="w-px bg-background" />
        <div className="h-full rounded-r-full transition-all duration-700 ml-auto"
          style={{ width: `${noProb}%`, background: "linear-gradient(90deg,#cc2460,#ff2d78)", boxShadow: noProb > 5 ? "-2px 0 8px rgba(255,45,120,0.4)" : "none" }} />
      </div>
    </div>
  );
}

export function OddsChip({ side, prob, className }: { side: "YES"|"NO"; prob: number; className?: string }) {
  const isYes = side === "YES";
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold tabular-nums",
      isYes ? "bg-cyan/10 text-cyan border border-cyan/20" : "bg-pink/10 text-pink border border-pink/20", className)}>
      {side} {fmtProb(prob)}
    </span>
  );
}
