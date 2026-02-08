import { Auth0Client } from "@auth0/nextjs-auth0/server"

// Scope and audience are configured here rather than via env vars because
// Auth0 v4 removed AUTH0_SCOPE/AUTH0_AUDIENCE env var support.
// Audience must match the API identifier in Auth0 dashboard.
export const auth0 = new Auth0Client({
  authorizationParameters: {
    scope:
      "openid profile email offline_access " +
      "beancounter beancounter:user beancounter:admin",
    audience: "https://holdsworth.app",
    prompt: "login",
  },
})
