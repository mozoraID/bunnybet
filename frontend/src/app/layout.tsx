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
import { initRelayClient } from "@/lib/relay";
import { Navbar }    from "@/components/layout/Navbar";

// Display font — heavy condensed for MegaETH headlines
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "700", "900"],
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

// Alias display font to sans
const displayFont = inter;

const rkTheme = darkTheme({
  accentColor:           "#f0ece4",
  accentColorForeground: "#0a0a0a",
  borderRadius:          "none",
});
Object.assign(rkTheme.colors, {
  modalBackground:  "#1a1a1a",
  modalBorder:      "rgba(255,255,255,0.08)",
  profileForeground: "#222",
  menuItemBackground: "#222",
});

initRelayClient();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: 2 } },
  }));

  return (
    <html lang="en" className={`${inter.variable} ${mono.variable} ${displayFont.variable}`}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>BUNNYBET — PREDICTION MARKETS ON MEGAETH</title>
        <meta name="description" content="Trade real-world outcomes with USDM stablecoin. Settled on MegaETH." />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="font-sans bg-ink text-off-white antialiased">
        <WagmiProvider config={wagmiConfig}>
          <QueryClientProvider client={qc}>
            <RainbowKitProvider theme={rkTheme} initialChain={megaETH}>

              <div className="flex flex-col min-h-screen">
                <Navbar />
                <main className="flex-1">{children}</main>

                {/* Footer — dark, monospace */}
                <footer className="border-t border-border-dark bg-ink-2 py-6">
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 font-mono text-xs text-dim-2">
                      <div>
                        <span className="text-off-white font-bold tracking-widest">BUNNYBET</span>
                        <span className="ml-3 text-dim-2">PREDICTION MARKETS</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span>SETTLED ON{" "}
                          <a href="https://megaeth.com" target="_blank" rel="noreferrer"
                            className="text-off-white hover:underline">MEGAETH</a>
                        </span>
                        <span>USDM STABLECOIN</span>
                        <span>CHAIN ID: 4326</span>
                      </div>
                    </div>
                  </div>
                </footer>
              </div>

              <Toaster
                position="bottom-right"
                toastOptions={{
                  style: {
                    background:   "#1a1a1a",
                    color:        "#f0ece4",
                    border:       "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "0px",
                    fontSize:     "13px",
                    fontFamily:   "var(--font-mono)",
                  },
                  success: { iconTheme: { primary: "#f0ece4", secondary: "#111" } },
                  error:   { iconTheme: { primary: "#888",    secondary: "#111" } },
                }}
              />
            </RainbowKitProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </body>
    </html>
  );
}
