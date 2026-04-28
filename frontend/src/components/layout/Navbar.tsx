"use client";

import Link            from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { BarChart2, Briefcase, Plus, Zap } from "lucide-react";
import { usePrices }   from "@/hooks/usePrices";
import { cn }          from "@/lib/utils";

const LINKS = [
  { href: "/",          label: "Markets",   icon: BarChart2 },
  { href: "/portfolio", label: "Portfolio", icon: Briefcase },
  { href: "/create",    label: "Create",    icon: Plus      },
];

function EthTicker() {
  const { data } = usePrices();
  const eth = data?.prices["ETH"];
  if (!eth) return null;
  const up = eth.change24h >= 0;
  return (
    <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-lg bg-bg-3 border border-border text-xs font-mono">
      <span className="text-secondary">ETH</span>
      <span className="text-primary font-semibold">${eth.price.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
      <span className={up ? "text-green" : "text-red"}>
        {up ? "+" : ""}{eth.change24h.toFixed(2)}%
      </span>
    </div>
  );
}

export function Navbar() {
  const path = usePathname();

  return (
    <>
      {/* Desktop header */}
      <header className="sticky top-0 z-50 border-b border-border bg-bg/90 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-6">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <span className="text-xl leading-none">🐰</span>
            <span className="font-bold tracking-tight text-base">
              Bunny<span className="text-green">Bet</span>
            </span>
          </Link>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-0.5 flex-1">
            {LINKS.map(({ href, label, icon: Icon }) => {
              const active = href === "/" ? path === "/" : path.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                    active
                      ? "text-white bg-white/8"
                      : "text-secondary hover:text-white hover:bg-white/5"
                  )}
                >
                  <Icon size={14} />
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3 shrink-0">
            <EthTicker />
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green/8 border border-green/20 text-xs font-mono text-green">
              <Zap size={10} className="animate-pulse" />
              MegaETH
            </div>
            <ConnectButton accountStatus="avatar" chainStatus="none" showBalance={false} />
          </div>
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border bg-bg/95 backdrop-blur">
        <div className="flex items-center justify-around h-14">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-4 py-2 text-xs transition-colors",
                  active ? "text-green" : "text-secondary"
                )}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
