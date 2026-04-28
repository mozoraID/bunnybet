import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // MegaETH brand — dark background, electric green accent
        bg:          "#080808",
        "bg-2":      "#0f0f0f",
        "bg-3":      "#161616",
        "bg-4":      "#1d1d1d",
        border:      "rgba(255,255,255,0.07)",
        "border-hi": "rgba(255,255,255,0.13)",

        // Primary accent — MegaETH green
        green:  {
          DEFAULT: "#00ff88",
          dim:     "#00cc6a",
          muted:   "rgba(0,255,136,0.10)",
          glow:    "rgba(0,255,136,0.20)",
        },
        // Secondary accents
        red:    { DEFAULT: "#ff4545", muted: "rgba(255,69,69,0.10)" },
        purple: { DEFAULT: "#9b6fff", muted: "rgba(155,111,255,0.10)" },
        amber:  { DEFAULT: "#ffaa00", muted: "rgba(255,170,0,0.10)" },

        // Text scale
        primary:   "#f5f5f5",
        secondary: "#7a7a7a",
        tertiary:  "#3d3d3d",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      boxShadow: {
        "green-sm":   "0 0 12px rgba(0,255,136,0.15)",
        "green-md":   "0 0 24px rgba(0,255,136,0.20), 0 0 8px rgba(0,255,136,0.10)",
        "card":       "0 0 0 1px rgba(255,255,255,0.07)",
        "card-hover": "0 0 0 1px rgba(255,255,255,0.13), 0 8px 32px rgba(0,0,0,0.5)",
        "panel":      "inset 0 1px 0 rgba(255,255,255,0.04)",
      },
      animation: {
        "fade-up":    "fadeUp 0.3s ease-out both",
        "fade-in":    "fadeIn 0.2s ease-out both",
        "pulse-dot":  "pulseDot 1.8s ease-in-out infinite",
        "shimmer":    "shimmer 1.8s linear infinite",
        "spin-slow":  "spin 2s linear infinite",
      },
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        pulseDot: {
          "0%,100%": { opacity: "1", transform: "scale(1)" },
          "50%":     { opacity: "0.4", transform: "scale(0.8)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-600px 0" },
          "100%": { backgroundPosition:  "600px 0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
