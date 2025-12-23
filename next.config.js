/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * @type {import('next').NextConfig}
 */
const { i18n } = require("./next-i18next.config")
const path = require("path")
const nextConfig = {
  reactStrictMode: true,
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
  i18n,
  output: "standalone",
  // Performance optimizations
  experimental: {
    // Enable faster builds with optimizeCss
    optimizeCss: true,
  },
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
            key: "X-Frame-Options",
            value: "DENY",
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
const { withSentryConfig } = require("@sentry/nextjs")

module.exports = withSentryConfig(module.exports, {
  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  org: "monowai-developments-ltd",
  project: "bc-view",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // Source maps configuration
  sourcemaps: {
    // Disable source map upload if no auth token
    disable:
      !process.env.SENTRY_AUTH_TOKEN ||
      process.env.SENTRY_AUTH_TOKEN === "undefined",
    deleteSourcemapsAfterUpload: true,
  },

  // Upload a larger set of source maps for prettier stack traces
  widenClientFileUpload: true,

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
