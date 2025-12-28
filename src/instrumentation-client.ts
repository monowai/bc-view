// This file configures the initialization of Sentry on the client.
// It runs when the client bundle is loaded in the browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs"

// Patterns to filter out from transactions
const ignorePatterns = [
  "/api/ping",
  "/_next/data",
  "/_next/image",
  "/_next/static",
]

// Client-side env vars must use NEXT_PUBLIC_ prefix
const environment = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || "local"

Sentry.init({
  dsn: "https://77443f1427eaf68cd124ec3af629a438@o4508146873466880.ingest.de.sentry.io/4508155588182096",
  environment,

  // Define how likely traces are sampled. Adjust this value in production.
  tracesSampleRate: 0.2,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Capture replays on errors
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,

  // Propagate trace headers to API routes for distributed tracing
  tracePropagationTargets: [/^\/api\//],

  // Filter transactions by URL pattern
  // Note: ignoreTransactions matches transaction NAME, not always the URL
  beforeSendTransaction(event) {
    const url = event.request?.url || event.transaction || ""
    if (ignorePatterns.some((pattern) => url.includes(pattern))) {
      return null
    }
    return event
  },

  integrations: [
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
})

// Required for navigation instrumentation with Turbopack
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
