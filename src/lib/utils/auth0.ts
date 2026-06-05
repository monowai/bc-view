import { Auth0Client } from "@auth0/nextjs-auth0/server"
import { NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"

// Scope and audience are configured here rather than via env vars because
// Auth0 v4 removed AUTH0_SCOPE/AUTH0_AUDIENCE env var support.
// Audience must match the API identifier in Auth0 dashboard.
// enableParallelTransactions:false uses a single __txn cookie that is
// overwritten on each /auth/login. With the v4 default (true), every login
// flow writes a new __txn_<state> cookie; abandoned/back-buttoned flows
// accumulate until the browser per-host cookie cap evicts the entry for the
// state that finally completes, producing "The state parameter is invalid."
export const auth0 = new Auth0Client({
  enableParallelTransactions: false,
  authorizationParameters: {
    scope:
      "openid profile email offline_access " +
      "beancounter beancounter:user beancounter:admin " +
      "beancounter:ai beancounter:preview",
    audience: "https://holdsworth.app",
  },
  // The default onCallback unconditionally renders a "An error occurred during
  // the authorization flow." 500 page whenever the SDK passes an `error`,
  // even if the session cookie has already been set (the SDK runs internal
  // post-callback steps after persistence). Users who hit a trailing-handler
  // error would land on the error page but actually be authenticated — they
  // had to manually reload to discover their session was live.
  //
  // This hook splits the two cases:
  //   - `error && !session` → real auth failure: log to Sentry + redirect to
  //     /auth/login so the user can re-attempt cleanly.
  //   - `error && session`  → session persisted but trailing step threw:
  //     capture for visibility (with the actual SdkError, not the generic
  //     wrapper message) + redirect to the intended returnTo target.
  //   - `!error` → default behaviour, redirect to returnTo / "/".
  // eslint-disable-next-line require-await -- OnCallbackHook signature returns Promise<NextResponse>; async keyword keeps the implementation consistent with that contract.
  onCallback: async (error, ctx, session) => {
    const appBaseUrl =
      ctx.appBaseUrl ||
      process.env.APP_BASE_URL ||
      "https://kauri.monowai.com"
    const target = new URL(ctx.returnTo || "/", appBaseUrl)

    if (error && !session) {
      Sentry.captureException(error, {
        tags: { component: "auth0", phase: "callback", recovered: "false" },
      })
      console.error("[Auth0] callback failed (no session):", error)
      return NextResponse.redirect(new URL("/auth/login", appBaseUrl))
    }

    if (error && session) {
      Sentry.captureException(error, {
        level: "warning",
        tags: { component: "auth0", phase: "callback", recovered: "true" },
      })
      console.warn(
        "[Auth0] post-callback non-fatal error (session persisted):",
        error,
      )
      return NextResponse.redirect(target)
    }

    return NextResponse.redirect(target)
  },
})
