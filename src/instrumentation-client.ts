// This file configures the initialization of Sentry on the client.
// It runs when the client bundle is loaded in the browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: "https://77443f1427eaf68cd124ec3af629a438@o4508146873466880.ingest.de.sentry.io/4508155588182096",

  // Define how likely traces are sampled. Adjust this value in production.
  tracesSampleRate: 0.2,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Capture replays on errors
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
})

// Required for navigation instrumentation with Turbopack
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
