// This file configures the initialization of Sentry on the client.
// It runs when the client bundle is loaded in the browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

console.log("[Sentry Client] instrumentation-client.ts loading...")

import * as Sentry from "@sentry/nextjs"

// Patterns to filter out from transaction URLs and span operations
const ignorePatterns = [
  "/api/ping",
  "/_next/data",
  "/_next/image",
  "/_next/static",
  "resource.script",
  "resource.css",
  "resource.img",
  "resource.link",
  "resource.other",
  "browser.DNS",
  "browser.unloadEvent",
  "browser.connect",
  "browser.cache",
  "mark",
  "measure",
]

// Detect environment at runtime from hostname (no rebuild needed per environment)
// Examples: kauri.monowai.com -> "kauri", kauri-sit.monowai.com -> "kauri-sit"
//           192.168.0.40 -> "192.168.0.40", localhost -> "local"
function detectEnvironment(): string {
  if (typeof window === "undefined") return "server"
  const hostname = window.location.hostname
  if (hostname === "localhost" || hostname === "127.0.0.1") return "local"
  // Check if it's an IP address (keep as-is)
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return hostname
  // Extract first segment of FQDN (e.g., "kauri" from "kauri.monowai.com")
  return hostname.split(".")[0]
}

const environment = detectEnvironment()

console.log("[Sentry Client] Initializing with environment:", environment)

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

  // Filter transactions by URL pattern and remove noisy spans
  beforeSendTransaction(event) {
    const url = event.request?.url || event.transaction || ""
    if (ignorePatterns.some((pattern) => url.includes(pattern))) {
      return null
    }
    // Filter out spans matching ignore patterns
    if (event.spans) {
      event.spans = event.spans.filter(
        (span) => !ignorePatterns.some((pattern) => span.op === pattern),
      )
    }
    return event
  },

  integrations: [
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
    // Configure browser tracing to exclude noisy requests
    Sentry.browserTracingIntegration({
      // Don't create spans for Next.js internal fetch requests
      shouldCreateSpanForRequest: (url) => {
        return !ignorePatterns.some((pattern) => url.includes(pattern))
      },
      // Don't create spans for static resource loading
      ignoreResourceSpans: ignorePatterns,
    }),
  ],
})

console.log("[Sentry Client] Initialized successfully")

// Required for navigation instrumentation with Turbopack
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
