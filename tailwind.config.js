/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
  // Configuration to reduce CSS parser warnings
  future: {
    hoverOnlyWhenSupported: true,
  },
  experimental: {
    // Suppress experimental CSS feature warnings
    optimizeUniversalDefaults: true,
  },
}