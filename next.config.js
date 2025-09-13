/* eslint-disable @typescript-eslint/no-require-imports */
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
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
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
  // https://github.com/getsentry/sentry-webpack-plugin#options

  org: "monowai-developments-ltd",
  project: "bc-view",
  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,
  // Disable Sentry plugins if no auth token is provided
  disableServerWebpackPlugin:
    !process.env.SENTRY_AUTH_TOKEN ||
    process.env.SENTRY_AUTH_TOKEN === "undefined",
  disableClientWebpackPlugin:
    !process.env.SENTRY_AUTH_TOKEN ||
    process.env.SENTRY_AUTH_TOKEN === "undefined",

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Automatically annotate React components to show their full name in breadcrumbs and session replay
  reactComponentAnnotation: {
    enabled: true,
  },

  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  // Hides source maps from generated client bundles
  hideSourceMaps: true,

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
  // See the following for more information:
  // https://docs.sentry.io/product/crons/
  // https://vercel.com/docs/cron-jobs
  automaticVercelMonitors: true,
})
