import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        // Project-wide Arial
        sans: ["Arial", "Helvetica", "sans-serif"],
      },
      colors: {
        // Monochrome theme — black / grey / white.
        // (All existing `brand-*` utility classes now resolve to greyscale.)
        brand: {
          50: "#f5f5f5",
          100: "#e7e7e7",
          200: "#d4d4d4",
          300: "#b8b8b8",
          400: "#8f8f8f",
          500: "#5c5c5c",
          600: "#2b2b2b",
          700: "#1a1a1a",
          800: "#0f0f0f",
          900: "#000000",
        },
      },
      borderRadius: {
        // Every card / control = 2px (sharp, minimal). Pills keep `full`.
        none: "0",
        sm: "2px",
        DEFAULT: "2px",
        md: "2px",
        lg: "2px",
        xl: "2px",
        "2xl": "2px",
        "3xl": "2px",
      },
    },
  },
  plugins: [],
};

export default config;
