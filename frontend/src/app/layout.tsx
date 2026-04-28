"use client";
import "@rainbow-me/rainbowkit/styles.css";
import "./globals.css";
import { Inter, JetBrains_Mono } from "next/font/google";
import { WagmiProvider }          from "wagmi";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster }   from "react-hot-toast";
import { useState }  from "react";
import { wagmiConfig, megaETH } from "@/lib/wagmi";
import { Navbar }    from "@/components/layout/Navbar";

const inter  = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono   = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

const rkTheme = darkTheme({ accentColor: "#00f5ff", accentColorForeground: "#050505", borderRadius: "medium" });
Object.assign(rkTheme.colors, { modalBackground: "#0d0d0d", modalBorder: "rgba(0,245,255,0.12)", profileForeground: "#141414" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 2 } } }));
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>BunnyBet 🐰 — Prediction Markets · USDM · MegaETH</title>
        <meta name="description" content="Trade the future with USDM stablecoin on MegaETH." />
      </head>
      <body className="font-sans bg-background text-primary antialiased">
        <WagmiProvider config={wagmiConfig}>
          <QueryClientProvider client={qc}>
            <RainbowKitProvider theme={rkTheme} initialChain={megaETH}>
              {/* Ambient glow blobs */}
              <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-cyan/5 blur-[120px]" />
                <div className="absolute top-1/3 -right-32 w-80 h-80 rounded-full bg-purple/5 blur-[100px]" />
                <div className="absolute -bottom-32 left-1/3 w-72 h-72 rounded-full bg-pink/5 blur-[100px]" />
              </div>
              <div className="relative z-10 flex flex-col min-h-screen">
                <Navbar />
                <main className="flex-1">{children}</main>
                <footer className="border-t border-border py-5 text-center text-tertiary text-xs">
                  <span className="gradient-text font-semibold">BunnyBet 🐰</span>
                  {" "}· Powered by <span className="text-cyan/70">USDM</span> on{" "}
                  <a href="https://megaeth.com" target="_blank" rel="noreferrer" className="text-cyan/70 hover:text-cyan">MegaETH</a>
                </footer>
              </div>
              <Toaster position="bottom-right" toastOptions={{
                style: { background: "#141414", color: "#f0f0f0", border: "1px solid rgba(0,245,255,0.15)", borderRadius: "8px", fontSize: "14px" },
                success: { iconTheme: { primary: "#00f5ff", secondary: "#050505" } },
                error:   { iconTheme: { primary: "#ff2d78", secondary: "#050505" } },
              }} />
            </RainbowKitProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </body>
    </html>
  );
}
