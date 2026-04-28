"use client";
import { CATEGORIES, type Category } from "@/types/market";
import { cn } from "@/lib/utils";

export function CategoryFilter({ selected, onChange, className }: { selected: Category; onChange: (c: Category) => void; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2 overflow-x-auto pb-1", className)}>
      {CATEGORIES.map((cat) => (
        <button key={cat} onClick={() => onChange(cat)}
          className={cn("shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all",
            selected === cat ? "bg-cyan text-background font-bold shadow-cyan-glow" : "glass text-secondary border border-border hover:text-primary hover:border-cyan/20")}>
          {cat}
        </button>
      ))}
    </div>
  );
}
