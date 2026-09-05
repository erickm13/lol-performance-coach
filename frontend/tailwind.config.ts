import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0A0E12",
        panel: "#131A21",
        "panel-line": "#223038",
        mist: "#7C8B93",
        parchment: "#E7EEF0",
        teal: {
          DEFAULT: "#3ED6C4",
          dim: "#2A9C8F",
        },
        gold: {
          DEFAULT: "#D4A45C",
          dim: "#8C6B36",
        },
        ember: "#E8563D",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
