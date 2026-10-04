import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        page: "var(--bg-page)",
        card: "var(--bg-card)",
        "card-alt": "var(--bg-card-alt)",
      },
      fontFamily: {
        display: ["'Cabinet Grotesk'", "'General Sans'", "'Space Grotesk'", "Inter", "sans-serif"],
      },
      borderRadius: {
        card: "26px",
      },
    },
  },
  plugins: [],
};
export default config;
