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
