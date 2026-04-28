"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { BarChart2, Wallet, Plus, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/",          label: "Markets",   icon: BarChart2 },
  { href: "/portfolio", label: "Portfolio", icon: Wallet    },
  { href: "/create",    label: "Create",    icon: Plus      },
];

export function Navbar() {
  const path = usePathname();
  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border glass">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2 group">
              <span className="text-2xl select-none group-hover:animate-bounce">🐰</span>
              <div className="hidden sm:block">
                <span className="font-bold text-lg tracking-tight gradient-text">BunnyBet</span>
                <span className="ml-2 text-xs text-cyan/60 font-mono">USDM</span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {LINKS.map(({ href, label, icon: Icon }) => {
                const active = href === "/" ? path === "/" : path.startsWith(href);
                return (
                  <Link key={href} href={href} className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all",
                    active ? "text-cyan bg-cyan/10 shadow-[0_0_0_1px_rgba(0,245,255,0.2)]"
                           : "text-secondary hover:text-primary hover:bg-surface-2"
                  )}>
                    <Icon size={14} />{label}
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full glass-cyan text-xs font-mono text-cyan">
                <Zap size={10} className="animate-pulse" />USDM · MegaETH
              </div>
              <ConnectButton accountStatus="avatar" chainStatus="none" showBalance={false} />
            </div>
          </div>
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 glass border-t border-border">
        <div className="flex items-center justify-around h-14">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link key={href} href={href} className={cn(
                "flex flex-col items-center gap-0.5 px-4 py-2 text-xs transition-colors",
                active ? "text-cyan" : "text-secondary"
              )}>
                <Icon size={18} />{label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
