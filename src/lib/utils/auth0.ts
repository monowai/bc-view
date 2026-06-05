import { Auth0Client } from "@auth0/nextjs-auth0/server"

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
})
