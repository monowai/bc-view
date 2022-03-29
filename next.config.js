/** @type {import('next').NextConfig} */
const { i18n } = require("./next-i18next.config");
const nextConfig = {
  reactStrictMode: true,
};
const path = require("path");
module.exports = {
  publicRuntimeConfig: {
    topicTrn:
      process.env.NODE_ENV === "development" || process.env.NODE_ENV === "docker"
        ? "bc-trn-csv-dev" // queue for localhost dev
        : "bc-trn-csv-demo", // production queue

    kafkaUrl:
      process.env.NODE_ENV === "development" || process.env.NODE_ENV === "docker"
        ? "localhost:9092" // development api
        : "kafka:9092", // production api
    apiDataUrl:
      process.env.NODE_ENV === "development"
        ? "http://localhost:9510/api" // development api
        : process.env.NODE_ENV === "docker"
        ? "http://localhost:9610/api"
        : "http://data:9510/api", // production api
    apiPositionsUrl:
      process.env.NODE_ENV === "development"
        ? "http://localhost:9500/api" // development api
        : process.env.NODE_ENV === "docker"
        ? "http://localhost:9510/api"
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
