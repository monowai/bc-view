// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs"
import {
  getSentryDsn,
  getSentryEnabled,
  getSentryEnvironment,
  getSentryTracesSampleRate,
  getSentryIgnoreTransactions,
  getTracePropagationTargets,
} from "@utils/api/bcConfig"

const enabled = getSentryEnabled()
const dsn = getSentryDsn()
const ignorePatterns = getSentryIgnoreTransactions()

if (!enabled) {
  console.log("[Sentry Server] Disabled - skipping initialization")
} else {
  const environment = getSentryEnvironment()
  console.log(
    "[Sentry Server] Initializing - dsn:",
    dsn ? "set" : "not set",
    "env:",
    environment,
  )
  Sentry.init({
    dsn,
    environment,

    tracesSampleRate: getSentryTracesSampleRate(),

    // Propagate trace headers to backend services for distributed tracing
    tracePropagationTargets: getTracePropagationTargets(),

    // Filter and rename transactions
    // Note: ignoreTransactions matches transaction NAME, not URL
    // We use beforeSendTransaction for URL-based filtering
    beforeSendTransaction(event) {
      const url = event.request?.url || ""

      // Filter by URL pattern (ignoreTransactions only matches transaction names)
      if (ignorePatterns.some((pattern) => url.includes(pattern))) {
        return null
      }

      // Rename generic transactions to include the URL path
      if (
        event.transaction === "middleware" ||
        event.transaction === "http.server.middleware" ||
        event.transaction === "GET" ||
        event.transaction === "POST"
      ) {
        try {
          const urlPath = new URL(url).pathname
          event.transaction = `${event.transaction} ${urlPath}`
        } catch {
          // Keep original if URL parsing fails
        }
      }
      return event
    },
  })
}
