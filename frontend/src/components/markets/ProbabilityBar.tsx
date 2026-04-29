"use client";

import { cn, fmtProb } from "@/lib/utils";

interface Props {
  yesProb:     number;
  noProb:      number;
  size?:       "xs" | "sm" | "md" | "lg";
  showLabels?: boolean;
  dark?:       boolean;   // true = dark card, false = light card
  className?:  string;
}

export function ProbabilityBar({
  yesProb, noProb, size = "md", showLabels = true, dark = false, className,
}: Props) {
  const h = { xs: "h-1", sm: "h-1.5", md: "h-2.5", lg: "h-4" }[size];
  const t = { xs: "text-xs", sm: "text-xs", md: "text-sm", lg: "text-base" }[size];

  const labelYes = dark ? "text-off-white" : "text-black";
  const labelNo  = dark ? "text-dim-2"     : "text-gray-2";

  return (
    <div className={cn("w-full", className)}>
      {showLabels && (
        <div className="flex items-baseline justify-between mb-1.5">
          <span className={cn("font-mono font-bold tabular-nums", t, labelYes)}>
            YES {fmtProb(yesProb)}
          </span>
          <span className={cn("font-mono font-bold tabular-nums", t, labelNo)}>
            NO {fmtProb(noProb)}
          </span>
        </div>
      )}
      <div className={cn(
        "w-full rounded-none overflow-hidden flex gap-px",
        h,
        dark ? "bg-ink-4" : "bg-cream-3"
      )}>
        {/* YES = black */}
        <div
          className="h-full transition-all duration-700 ease-out"
          style={{ width: `${yesProb}%`, background: dark ? "#f0ece4" : "#0a0a0a" }}
        />
        {/* NO = gray */}
        <div
          className="h-full transition-all duration-700 ease-out ml-auto"
          style={{ width: `${noProb}%`, background: dark ? "#555" : "#888" }}
        />
      </div>
    </div>
  );
}

export function OutcomePill({ side, prob, dark = false, className }: {
  side: "YES" | "NO"; prob: number; dark?: boolean; className?: string;
}) {
  const isYes = side === "YES";
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 font-mono text-xs font-bold tabular-nums border",
      dark
        ? isYes
          ? "bg-off-white/10 text-off-white border-off-white/20"
          : "bg-white/5 text-dim-2 border-border-dark"
        : isYes
          ? "bg-black/8 text-black border-black/15"
          : "bg-black/5 text-gray-2 border-black/10",
      className
    )}>
      {side} {fmtProb(prob)}
    </span>
  );
}
