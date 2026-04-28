"use client";

import { cn, fmtProb } from "@/lib/utils";

interface ProbabilityBarProps {
  yesProb:     number;
  noProb:      number;
  size?:       "xs" | "sm" | "md" | "lg";
  showLabels?: boolean;
  className?:  string;
}

export function ProbabilityBar({
  yesProb,
  noProb,
  size       = "md",
  showLabels = true,
  className,
}: ProbabilityBarProps) {
  const h = { xs: "h-1", sm: "h-1.5", md: "h-2.5", lg: "h-4" }[size];
  const t = { xs: "text-xs", sm: "text-xs", md: "text-sm", lg: "text-base" }[size];

  return (
    <div className={cn("w-full", className)}>
      {showLabels && (
        <div className="flex items-baseline justify-between mb-1.5">
          <span className={cn("font-bold tabular-nums text-green", t)}>
            YES {fmtProb(yesProb)}
          </span>
          <span className={cn("font-bold tabular-nums text-red", t)}>
            NO {fmtProb(noProb)}
          </span>
        </div>
      )}
      <div className={cn("w-full rounded-full overflow-hidden bg-bg-4 flex gap-px", h)}>
        <div
          className="h-full rounded-l-full transition-all duration-700 ease-out"
          style={{
            width:      `${yesProb}%`,
            background: "linear-gradient(90deg, #00cc6a, #00ff88)",
            boxShadow:  yesProb > 3 ? "2px 0 10px rgba(0,255,136,0.3)" : "none",
          }}
        />
        <div
          className="h-full rounded-r-full transition-all duration-700 ease-out ml-auto"
          style={{
            width:      `${noProb}%`,
            background: "linear-gradient(90deg, #cc3636, #ff4545)",
            boxShadow:  noProb > 3 ? "-2px 0 10px rgba(255,69,69,0.3)" : "none",
          }}
        />
      </div>
    </div>
  );
}

export function OutcomePill({
  side,
  prob,
  className,
}: {
  side: "YES" | "NO";
  prob: number;
  className?: string;
}) {
  const isYes = side === "YES";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold tabular-nums border",
        isYes
          ? "bg-green/10  text-green  border-green/20"
          : "bg-red/10    text-red    border-red/20",
        className
      )}
    >
      {side} {fmtProb(prob)}
    </span>
  );
}
