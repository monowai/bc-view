// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs"
import { getSentryDsn, getSentryTracesSampleRate } from "@utils/api/bc-config"

Sentry.init({
  dsn: getSentryDsn(),

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: Number(getSentryTracesSampleRate()),

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
})
