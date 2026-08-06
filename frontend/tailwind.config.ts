import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Driven by the CSS variables in globals.css, so the palette lives in
        // one place instead of being spelled out in every component.
        bg: "rgb(var(--dq-bg) / <alpha-value>)",
        surface: "rgb(var(--dq-surface) / <alpha-value>)",
        "surface-muted": "rgb(var(--dq-surface-muted) / <alpha-value>)",
        line: "rgb(var(--dq-border) / <alpha-value>)",
        content: "rgb(var(--dq-text) / <alpha-value>)",
        muted: "rgb(var(--dq-text-muted) / <alpha-value>)",
        brand: {
          DEFAULT: "rgb(var(--dq-brand) / <alpha-value>)",
          strong: "rgb(var(--dq-brand-strong) / <alpha-value>)",
        },
        danger: "rgb(var(--dq-danger) / <alpha-value>)",
      },
      screens: {
        mob: "375px",
        tab: "640px",
        lap: "1024px",
        desk: "1536px",
      },
      fontFamily: {
        sans: ["var(--font-poppins)", "system-ui", "sans-serif"],
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.97)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "slide-up": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 150ms ease-out",
        "scale-in": "scale-in 150ms ease-out",
        "slide-up": "slide-up 220ms cubic-bezier(0.32, 0.72, 0, 1)",
        "slide-in-right": "slide-in-right 220ms cubic-bezier(0.32, 0.72, 0, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
