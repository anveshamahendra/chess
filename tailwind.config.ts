import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        page: "#f2f2f0",
        card: "#0a0a0a",
        "card-alt": "#121212",
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
