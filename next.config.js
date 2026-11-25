/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * @type {import('next').NextConfig}
 */
const path = require("path")
const nextConfig = {
  reactStrictMode: true,
  reactCompiler: true,
  experimental: {
    // Marks this app for `next upgrade --agent=security`: security patch upgrades.
    agentUpgrade: "security",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "s.gravatar.com",
      },
      {
        protocol: "https",
        hostname: "cdn.auth0.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  sassOptions: {
    includePaths: [path.join(__dirname, "styles")],
  },
  output: "standalone",
  // Browser source maps, for Sentry. They are never served: `yarn build` runs
  // scripts/source-maps.sh, which stamps debug IDs, keeps chunks and maps in
  // .next/sourcemaps and deletes the maps from .next/static. bc-deploy uploads
  // them from the running pod. Server maps are written anyway.
  productionBrowserSourceMaps: true,
  // Turbopack configuration (for dev mode with --turbopack)
  turbopack: {
    rules: {
      // Configure Turbopack loaders if needed
      "*.svg": {
        loaders: ["@svgr/webpack"],
        as: "*.js",
      },
    },
  },
  // Optimize webpack (production only - dev uses Turbopack)
  webpack: (config, { dev, isServer }) => {
    // Only apply webpack optimizations for production builds
    // Dev mode uses Turbopack via --turbopack flag
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: "all",
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: "vendors",
            chunks: "all",
          },
        },
      }
    }
    return config
  },
  // Enable compression
  compress: true,
  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            // SAMEORIGIN (not DENY) so first-party tools/marketing pages
            // can embed the static playgrounds under /tools/*.html in an
            // iframe (e.g. /tools/cost-stack embeds /tools/cost-stack.html).
            // Still blocks any cross-origin clickjacking attempt.
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ]
  },
  // Optimize bundle analyzer (optional - for debugging)
  ...(process.env.ANALYZE === "true" && {
    webpack: (config) => {
      config.plugins.push(
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        new (require("@next/bundle-analyzer"))({
          enabled: true,
        }),
      )
      return config
    },
  }),
}
module.exports = nextConfig

// Injected content via Sentry wizard below

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { withSentryConfig } = require("@sentry/nextjs/config")

module.exports = withSentryConfig(module.exports, {
  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  org: "monowai-developments-ltd",
  project: "bc-view",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // The build uploads no maps. scripts/source-maps.sh readies them and
  // bc-deploy uploads them and records the release after a rollout, so only
  // what is deployed reaches Sentry and CI holds no token.
  sourcemaps: {
    disable: true,
  },

  // Route browser requests through Next.js to circumvent ad-blockers
  tunnelRoute: "/monitoring",

  // Webpack-specific options
  webpack: {
    // Automatically annotate React components for breadcrumbs and replay
    reactComponentAnnotation: {
      enabled: true,
    },
    // Tree-shake Sentry logger statements
    treeshake: {
      removeDebugLogging: true,
    },
    // Automatic instrumentation of Vercel Cron Monitors
    automaticVercelMonitors: true,
  },
})
