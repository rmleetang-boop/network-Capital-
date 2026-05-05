/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand palette v2 — Deep Navy / Brand Gold, per NC_BrandPalette_v2.pdf (60/30/10 rule).
        primary: {
          DEFAULT: "#002060",   // Deep Navy — brand name, headlines, headers, nav, trust
          foreground: "#FFFFFF",
          hover: "#003080",     // Primary Blue — backgrounds, cards, depth
          light: "#EDF2F9"      // Navy Tint — section dividers
        },
        secondary: {
          DEFAULT: "#E8A817",   // Brand Gold — tagline, CTAs, active states, earnings
          foreground: "#002060",
          hover: "#F0B800",     // Bright Gold — hover, confetti, notifications
          soft: "#FFF8EB"       // Gold Tint — highlight banners
        },
        background: {
          DEFAULT: "#FFFFFF",
          dark: "#0A1628",      // Near Black — dark mode base
          card: "#003080",      // Primary Blue for dark-mode cards
          subtle: "#F8F9FC"     // Off White — card backgrounds
        },
        text: {
          primary: "#002060",   // Deep Navy for headings on light bg
          secondary: "#6B7C93", // Body Gray
          muted: "#9AA6B5",
          light: "#EDF2F9"
        },
        accent: {
          gold: "#E8A817",
          goldBright: "#F0B800",
          goldSoft: "#FFF8EB",
          navyTint: "#EDF2F9",
          success: "#1B8A5A",
          warning: "#D08C00",
          error: "#D13438",
          link: "#005040"       // Mid Blue — links, avatars, secondary buttons
        },
        border: "#C4CDD9"
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