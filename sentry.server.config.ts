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

      // Drop empty middleware passthroughs. Sentry renames these to
      // "middleware <METHOD>" before beforeSendTransaction runs, so the
      // older equality checks below never matched. ~27k/day in production
      // were sub-1ms Auth0 client polls (/auth/profile, /auth/access-token)
      // with no child spans — pure noise. Real errors still flow via the
      // exception channel.
      const txn = event.transaction || ""
      const isMiddleware =
        txn === "middleware" ||
        txn === "http.server.middleware" ||
        /^middleware (GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)$/.test(txn)
      const hasChildSpans = (event.spans?.length ?? 0) > 0
      const hasException = (event.exception?.values?.length ?? 0) > 0
      if (isMiddleware && !hasChildSpans && !hasException) {
        return null
      }

      // Drop the duplicate http.server transaction that the OpenTelemetry
      // HTTP integration emits for every inbound API request. @sentry/nextjs's
      // Pages-Router wrapper emits a SECOND http.server transaction for the
      // same request with the resolved route name (e.g.
      // "GET /api/holdings/[code]" instead of "GET /api/holdings/USV") and
      // that one carries the "executing api route" child + downstream
      // http.client spans. The OTel one is just a thin HTTP envelope with
      // no useful children — keeping both doubles span ingestion on every
      // API request and clutters traces (observed 2026-06-05: every
      // /api/* request on /holdings/[code] produced two http.server spans).
      //
      // Heuristic: http.server transaction whose span list contains no
      // "executing api route" entry is the OTel one — drop it. The Pages
      // Router wrapper always emits that child, so this is robust to route
      // shape (top-level routes, /index files, [param] segments).
      const txnOp = event.contexts?.trace?.op
      const isApiInbound =
        txnOp === "http.server" && txn.includes(" /api/") && !isMiddleware
      const hasApiRouteChild = event.spans?.some((s) =>
        (s.description || "").startsWith("executing api route"),
      )
      if (isApiInbound && !hasApiRouteChild && !hasException) {
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
