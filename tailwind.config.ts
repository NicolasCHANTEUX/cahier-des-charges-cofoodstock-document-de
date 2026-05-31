import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/features/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#ecfdf5",
          100: "#d1fae5",
          500: "#10a37f",
          600: "#059669",
          700: "#047857",
          900: "#064e3b"
        },
        ink: "#0f172a"
      },
      boxShadow: {
        soft: "0 16px 45px rgba(15, 23, 42, 0.10)"
      }
    }
  },
  plugins: []
};

export default config;

