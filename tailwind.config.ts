import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          900: "#1e1b2e",
          700: "#3f3a56",
          500: "#6b6483",
          400: "#8b84a3",
          300: "#aca6c1",
        },
        lavender: {
          50: "#f8f7fc",
          100: "#f1eefa",
          200: "#e6e1f7",
        },
      },
      backgroundImage: {
        "aurora-blue": "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
        "aurora-full": "linear-gradient(135deg, #6366f1 0%, #a855f7 45%, #ec4899 75%, #f97316 100%)",
      },
      boxShadow: {
        soft: "0 2px 8px -2px rgba(80, 63, 205, 0.08), 0 12px 32px -8px rgba(80, 63, 205, 0.10)",
        glow: "0 8px 30px -6px rgba(139, 92, 246, 0.35)",
      },
      borderRadius: {
        "2xl": "20px",
        "3xl": "24px",
      },
    },
  },
  plugins: [],
};

export default config;
