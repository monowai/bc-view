/** @type {import('next').NextConfig} */
const { i18n } = require("./next-i18next.config");
const nextConfig = {
  reactStrictMode: true
};
const path = require("path");
module.exports = {
  images: {
    domains: ["s.gravatar.com", "cdn.auth0.com"]
  },
  sassOptions: {
    includePaths: [path.join(__dirname, "styles")]
  },
  experimental: {
    outputStandalone: true // Docker
  },
  i18n,
  nextConfig
};
