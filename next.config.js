/** @type {import('next').NextConfig} */
const { i18n } = require("./next-i18next.config");
const nextConfig = {
  reactStrictMode: true,
};
const path = require("path");
module.exports = {
  publicRuntimeConfig: {
    topicTrn: "bc-trn-csv-demo",
    kafkaUrl:
      process.env.NODE_ENV === "development"
        ? "http://localhost:9092" // development api
        : "http://kafka:9092", // production api
    apiDataUrl:
      process.env.NODE_ENV === "development"
        ? "http://localhost:9610/api" // development api
        : "http://data:9510/api", // production api
    apiPositionsUrl:
      process.env.NODE_ENV === "development"
        ? "http://localhost:9600/api" // development api
        : "http://position:9500/api", // production api
  },
  images: {
    domains: ["s.gravatar.com", "cdn.auth0.com"],
  },
  sassOptions: {
    includePaths: [path.join(__dirname, "styles")],
  },
  experimental: {
    outputStandalone: true, // Docker
  },
  i18n,
  nextConfig,
};
