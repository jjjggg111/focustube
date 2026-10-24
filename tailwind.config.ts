import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "media",
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "var(--font-noto-kr)", "-apple-system", "Apple SD Gothic Neo", "sans-serif"],
      },
    },
  },
} satisfies Config;
