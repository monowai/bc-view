// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs"
import {
  getSentryDsn,
  getSentryEnabled,
  getSentryEnvironment,
  getSentryIgnoreTransactions,
  getSentryTracesSampleRate,
} from "@utils/api/bcConfig"

const enabled = getSentryEnabled()
const dsn = getSentryDsn()
const ignorePatterns = getSentryIgnoreTransactions()

if (!enabled) {
  console.log("[Sentry Edge] Disabled - skipping initialization")
} else {
  Sentry.init({
    dsn,
    environment: getSentryEnvironment(),
    tracesSampleRate: getSentryTracesSampleRate(),
    debug: false,

    // Filter and rename transactions
    // Note: ignoreTransactions matches transaction NAME, not URL
    // We use beforeSendTransaction for URL-based filtering
    beforeSendTransaction(event) {
      const url = event.request?.url || ""

      // Filter by URL pattern
      if (ignorePatterns.some((pattern) => url.includes(pattern))) {
        return null
      }

      // Rename generic middleware transactions to include the URL path
      if (
        event.transaction === "middleware" ||
        event.transaction === "http.server.middleware"
      ) {
        try {
          const urlPath = new URL(url).pathname
          event.transaction = `middleware ${urlPath}`
        } catch {
          // Keep original if URL parsing fails
        }
      }
      return event
    },
  })
}
