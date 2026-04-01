/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#1E3A8A",
          foreground: "#FFFFFF",
          hover: "#1E40AF",
          light: "#3B82F6"
        },
        secondary: {
          DEFAULT: "#F59E0B",
          foreground: "#FFFFFF",
          hover: "#D97706"
        },
        background: {
          DEFAULT: "#FFFFFF",
          dark: "#0F172A",
          card: "#1E293B",
          subtle: "#F1F5F9"
        },
        text: {
          primary: "#0F172A",
          secondary: "#64748B",
          muted: "#94A3B8",
          light: "#E2E8F0"
        },
        accent: {
          gold: "#FFD700",
          silver: "#C0C0C0",
          bronze: "#CD7F32",
          green: "#10B981",
          blue: "#3B82F6",
          purple: "#8B5CF6",
          pink: "#EC4899"
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
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%)',
        'gradient-secondary': 'linear-gradient(135deg, #F59E0B 0%, #EAB308 100%)',
        'gradient-dark': 'linear-gradient(180deg, #0F172A 0%, #1E293B 100%)'
      }
    }
  },
  plugins: [require("tailwindcss-animate")]
};