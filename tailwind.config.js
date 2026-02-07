/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      screens: {
        portrait: { raw: "(orientation: portrait)" },
        landscape: { raw: "(orientation: landscape)" },
      },
      fontFamily: {
        sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        gain: {
          DEFAULT: "#059669", // emerald-600
          bg: "#ecfdf5", // emerald-50
        },
        loss: {
          DEFAULT: "#dc2626", // red-600
          bg: "#fef2f2", // red-50
        },
        wealth: {
          50: "#eff6ff", // blue-50
          100: "#dbeafe", // blue-100
          200: "#bfdbfe", // blue-200
          500: "#3b82f6", // blue-500
          600: "#2563eb", // blue-600
          700: "#1d4ed8", // blue-700
        },
        independence: {
          50: "#fff7ed", // orange-50
          100: "#ffedd5", // orange-100
          200: "#fed7aa", // orange-200
          500: "#f97316", // orange-500
          600: "#ea580c", // orange-600
          700: "#c2410c", // orange-700
        },
        invest: {
          50: "#ecfdf5", // emerald-50
          100: "#d1fae5", // emerald-100
          200: "#a7f3d0", // emerald-200
          500: "#10b981", // emerald-500
          600: "#059669", // emerald-600
          700: "#047857", // emerald-700
        },
      },
    },
  },
  plugins: [
    function ({ addVariant }) {
      // Add variant for mobile portrait (max-width: 640px and portrait orientation)
      addVariant(
        "mobile-portrait",
        "@media (max-width: 639px) and (orientation: portrait)",
      )
    },
  ],
  // Configuration to reduce CSS parser warnings
  future: {
    hoverOnlyWhenSupported: true,
  },
  experimental: {
    // Suppress experimental CSS feature warnings
    optimizeUniversalDefaults: true,
  },
}
