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
