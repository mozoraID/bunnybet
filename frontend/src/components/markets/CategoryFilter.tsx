"use client";

import { CATEGORIES, type Category } from "@/types/market";
import { cn } from "@/lib/utils";

export function CategoryFilter({
  selected,
  onChange,
  className,
}: {
  selected:  Category;
  onChange:  (c: Category) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-px", className)}>
      {CATEGORIES.map((cat) => (
        <button
          key={cat}
          onClick={() => onChange(cat)}
          className={cn(
            "shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap",
            selected === cat
              ? "bg-green text-bg font-bold shadow-green-sm"
              : "border border-border text-secondary hover:text-white hover:border-border-hi bg-bg-3"
          )}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}
