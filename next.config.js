/**
 * @type {import('next').NextConfig}
 */
const { i18n } = require("./next-i18next.config")
const path = require("path")
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ["s.gravatar.com", "cdn.auth0.com", "lh3.googleusercontent.com"],
  },
  sassOptions: {
    includePaths: [path.join(__dirname, "styles")],
  },
  i18n,
  output: "standalone",
}
module.exports = nextConfig
