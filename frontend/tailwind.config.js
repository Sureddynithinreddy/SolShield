/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Base canvas — deep navy/slate like the reference command center
        ink: {
          950: "#070b16",
          900: "#0b1020",
          850: "#0e1526",
          800: "#121a2e",
          700: "#1a2440",
          600: "#243150",
        },
        // Primary accent — cyan
        cyan: {
          DEFAULT: "#22d3ee",
          soft: "#67e8f9",
          deep: "#0891b2",
        },
        // Secondary accent — violet
        violet: {
          DEFAULT: "#8b5cf6",
          soft: "#a78bfa",
          deep: "#6d28d9",
        },
        // Verdict colors
        safe: "#34d399",
        caution: "#fbbf24",
        danger: "#f43f5e",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(34,211,238,0.15), 0 8px 40px -12px rgba(34,211,238,0.35)",
        "glow-violet": "0 0 0 1px rgba(139,92,246,0.15), 0 8px 40px -12px rgba(139,92,246,0.4)",
        card: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 20px 60px -24px rgba(0,0,0,0.8)",
      },
      backgroundImage: {
        "grid-faint":
          "linear-gradient(rgba(148,163,184,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.045) 1px, transparent 1px)",
        "radial-glow":
          "radial-gradient(60% 50% at 50% 0%, rgba(34,211,238,0.12), transparent 70%)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        pulseRing: {
          "0%": { transform: "scale(0.9)", opacity: "0.7" },
          "70%": { transform: "scale(1.3)", opacity: "0" },
          "100%": { opacity: "0" },
        },
        "spin-slow": {
          to: { transform: "rotate(360deg)" },
        },
        "dash-scan": {
          "0%": { strokeDashoffset: "0" },
          "100%": { strokeDashoffset: "-40" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s ease-out both",
        "scale-in": "scale-in 0.25s ease-out both",
        shimmer: "shimmer 2s infinite",
        "pulse-ring": "pulseRing 1.8s cubic-bezier(0.2,0.6,0.3,1) infinite",
        "spin-slow": "spin-slow 1.2s linear infinite",
        "dash-scan": "dash-scan 1s linear infinite",
      },
    },
  },
  plugins: [],
};
