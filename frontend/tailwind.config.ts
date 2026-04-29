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
        // ── MegaETH palette ──────────────────────────────────
        // Light mode surfaces (hero, cards)
        cream:     "#f0ece4",
        "cream-2": "#e8e4dc",
        "cream-3": "#dedad2",
        // Dark mode surfaces (nav, data panels, footer)
        ink:       "#111111",
        "ink-2":   "#1a1a1a",
        "ink-3":   "#222222",
        "ink-4":   "#2a2a2a",
        // Text on light
        black:     "#0a0a0a",
        "gray-1":  "#333333",
        "gray-2":  "#666666",
        "gray-3":  "#999999",
        // Text on dark
        "off-white": "#f0ece4",
        "dim-white": "#aaaaaa",
        "dim-2":     "#555555",
        // Borders
        "border-light": "rgba(0,0,0,0.10)",
        "border-dark":  "rgba(255,255,255,0.08)",
        // Semantic (no neon)
        yes:    "#0a0a0a",   // black button = YES
        no:     "#666666",   // gray button = NO
      },
      fontFamily: {
        // MegaETH uses extended bold sans + mono
        sans:    ["var(--font-sans)", "system-ui", "sans-serif"],
        mono:    ["var(--font-mono)", "monospace"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
      },
      fontSize: {
        "display-xl": ["clamp(2.5rem, 6vw, 5rem)", { lineHeight: "0.95", letterSpacing: "-0.02em" }],
        "display-lg": ["clamp(1.75rem, 4vw, 3rem)", { lineHeight: "1", letterSpacing: "-0.01em" }],
      },
      boxShadow: {
        "card-light": "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.05)",
        "card-hover": "0 4px 16px rgba(0,0,0,0.12)",
        "panel":      "inset 0 1px 0 rgba(255,255,255,0.06)",
      },
      animation: {
        "fade-up":   "fadeUp 0.3s ease-out both",
        "fade-in":   "fadeIn 0.2s ease-out both",
        "shimmer":   "shimmer 1.8s linear infinite",
        "blink":     "blink 1s step-end infinite",
      },
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn:  { from: { opacity: "0" }, to: { opacity: "1" } },
        shimmer: {
          "0%":   { backgroundPosition: "-600px 0" },
          "100%": { backgroundPosition:  "600px 0" },
        },
        blink: {
          "0%,100%": { opacity: "1" },
          "50%":     { opacity: "0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
