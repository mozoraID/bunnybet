"use client";
import { CATEGORIES, type Category } from "@/types/market";
import { cn } from "@/lib/utils";

export function CategoryFilter({ selected, onChange, className }: {
  selected: Category; onChange: (c: Category) => void; className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1.5 overflow-x-auto no-scrollbar", className)}>
      {CATEGORIES.map((cat) => (
        <button key={cat} onClick={() => onChange(cat)}
          className={cn(
            "shrink-0 px-3 py-1 font-mono text-xs tracking-widest border transition-all whitespace-nowrap",
            selected === cat
              ? "bg-off-white text-ink border-off-white"
              : "text-dim-2 border-border-dark hover:text-off-white hover:border-off-white/30"
          )}>
          {cat.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
