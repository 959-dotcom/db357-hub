import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#060709",
        ivory: "#F5F5F7",
        mute: "#8E929F",
        gold: "#D4AF37",
        goldsoft: "#E5C158",
      },
      boxShadow: {
        desk: "0 24px 80px rgba(0,0,0,0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
