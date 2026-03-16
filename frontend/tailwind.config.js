/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#0055FF",
          foreground: "#FFFFFF",
          hover: "#0044CC"
        },
        secondary: {
          DEFAULT: "#00B341",
          foreground: "#FFFFFF",
          hover: "#009933"
        },
        background: {
          DEFAULT: "#F8F9FA",
          paper: "#FFFFFF",
          subtle: "#F1F5F9"
        },
        text: {
          primary: "#0F172A",
          secondary: "#64748B",
          muted: "#94A3B8"
        },
        accent: {
          gold: "#FFD700",
          silver: "#C0C0C0",
          bronze: "#CD7F32"
        },
        border: "#E2E8F0"
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        heading: ['Manrope', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)"
      }
    }
  },
  plugins: [require("tailwindcss-animate")]
};