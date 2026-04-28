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

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const rkTheme = darkTheme({
  accentColor:           "#00ff88",
  accentColorForeground: "#080808",
  borderRadius:          "medium",
});
Object.assign(rkTheme.colors, {
  modalBackground:  "#0f0f0f",
  modalBorder:      "rgba(255,255,255,0.09)",
  profileForeground: "#161616",
  menuItemBackground: "#161616",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [qc] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 2 } } })
  );

  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>BunnyBet — Prediction Markets on MegaETH</title>
        <meta
          name="description"
          content="Trade real-world outcomes with USDM stablecoin. Powered by MegaETH."
        />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="font-sans bg-bg text-primary antialiased">
        <WagmiProvider config={wagmiConfig}>
          <QueryClientProvider client={qc}>
            <RainbowKitProvider theme={rkTheme} initialChain={megaETH}>

              <div className="flex flex-col min-h-screen">
                <Navbar />
                <main className="flex-1">{children}</main>
                <footer className="border-t border-border py-4 text-center text-tertiary text-xs">
                  <span className="gradient-text font-semibold">BunnyBet</span>
                  {" · "}
                  <span className="text-green/70">USDM</span>
                  {" on "}
                  <a
                    href="https://megaeth.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-green/70 hover:text-green transition-colors"
                  >
                    MegaETH
                  </a>
                </footer>
              </div>

              <Toaster
                position="bottom-right"
                toastOptions={{
                  style: {
                    background:   "#161616",
                    color:        "#f5f5f5",
                    border:       "1px solid rgba(255,255,255,0.09)",
                    borderRadius: "10px",
                    fontSize:     "14px",
                  },
                  success: { iconTheme: { primary: "#00ff88", secondary: "#080808" } },
                  error:   { iconTheme: { primary: "#ff4545", secondary: "#080808" } },
                }}
              />

            </RainbowKitProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </body>
    </html>
  );
}
