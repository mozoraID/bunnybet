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
        background:  "#050505",
        surface:     "#0d0d0d",
        "surface-2": "#141414",
        "surface-3": "#1a1a1a",
        border:      "rgba(255,255,255,0.06)",
        cyan:   { DEFAULT: "#00f5ff", dim: "#00c4cc", glow: "rgba(0,245,255,0.15)" },
        pink:   { DEFAULT: "#ff2d78", dim: "#cc2460", glow: "rgba(255,45,120,0.15)" },
        purple: { DEFAULT: "#b06fff", dim: "#8c4fcc", glow: "rgba(176,111,255,0.15)" },
        yes:    "#00f5ff",
        no:     "#ff2d78",
        primary:   "#f0f0f0",
        secondary: "#8892a4",
        tertiary:  "#4a5568",
        muted:     "#3d4450",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      boxShadow: {
        "cyan-glow":   "0 0 20px rgba(0,245,255,0.25), 0 0 60px rgba(0,245,255,0.1)",
        "pink-glow":   "0 0 20px rgba(255,45,120,0.25), 0 0 60px rgba(255,45,120,0.1)",
        "card":        "0 1px 0 rgba(255,255,255,0.05), 0 4px 24px rgba(0,0,0,0.4)",
        "card-hover":  "0 1px 0 rgba(0,245,255,0.1), 0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,245,255,0.08)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4,0,0.6,1) infinite",
        "slide-up":   "slideUp 0.4s cubic-bezier(0.16,1,0.3,1)",
        "fade-in":    "fadeIn 0.3s ease-out",
      },
      keyframes: {
        slideUp: {
          from: { transform: "translateY(12px)", opacity: "0" },
          to:   { transform: "translateY(0)",    opacity: "1" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
