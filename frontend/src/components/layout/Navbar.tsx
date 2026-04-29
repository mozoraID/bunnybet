"use client";

import Link            from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { usePrices }   from "@/hooks/usePrices";
import { cn }          from "@/lib/utils";

const LINKS = [
  { href: "/",          label: "MARKETS"   },
  { href: "/portfolio", label: "PORTFOLIO" },
  { href: "/vault",     label: "VAULT"     },
  { href: "/create",    label: "+ CREATE"  },
];

function PriceTicker() {
  const { data } = usePrices();
  const symbols = ["BTC", "ETH", "SOL"];
  if (!data) return null;

  return (
    <div className="hidden lg:flex items-center gap-4 font-mono text-xs">
      {symbols.map((sym) => {
        const p = data.prices[sym];
        if (!p) return null;
        const up = p.change24h >= 0;
        return (
          <span key={sym} className="flex items-center gap-1.5">
            <span className="text-dim-2">{sym}</span>
            <span className="text-off-white">
              ${p.price.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </span>
            <span className={up ? "text-off-white/60" : "text-dim-2"}>
              {up ? "▲" : "▼"}{Math.abs(p.change24h).toFixed(1)}%
            </span>
          </span>
        );
      })}
    </div>
  );
}

export function Navbar() {
  const path = usePathname();

  return (
    <>
      {/* Desktop nav */}
      <header className="sticky top-0 z-50 border-b border-border-dark bg-ink/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center gap-8">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <span className="text-base leading-none">🐰</span>
            <span className="font-mono font-bold text-sm tracking-widest text-off-white uppercase">
              BUNNYBET
            </span>
          </Link>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-0.5 flex-1">
            {LINKS.map(({ href, label }) => {
              const active = href === "/" ? path === "/" : path.startsWith(href);
              return (
                <Link key={href} href={href} className={cn(
                  "px-3 py-1.5 font-mono text-xs tracking-widest transition-colors",
                  active
                    ? "text-off-white bg-white/8"
                    : "text-dim-2 hover:text-off-white hover:bg-white/5"
                )}>
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-4 ml-auto">
            <PriceTicker />
            {/* Chain badge */}
            <div className="hidden sm:flex items-center gap-1.5 border border-border-dark px-2 py-1 font-mono text-xs text-dim-2">
              <span className="w-1.5 h-1.5 rounded-full bg-off-white/40 inline-block" />
              MEGAETH
            </div>
            <ConnectButton accountStatus="avatar" chainStatus="none" showBalance={false} />
          </div>
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border-dark bg-ink/98">
        <div className="flex items-center justify-around h-12">
          {LINKS.filter(l => l.href !== "/create").map(({ href, label }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link key={href} href={href} className={cn(
                "flex flex-col items-center gap-0.5 px-4 py-2 font-mono text-[10px] tracking-widest transition-colors",
                active ? "text-off-white" : "text-dim-2"
              )}>
                {label}
              </Link>
            );
          })}
          <Link href="/create" className="flex flex-col items-center gap-0.5 px-4 py-2 font-mono text-[10px] tracking-widest text-dim-2">
            + CREATE
          </Link>
        </div>
      </nav>
    </>
  );
}
