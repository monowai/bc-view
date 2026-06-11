// Diagnostic helper for the Auth0 nextjs-auth0 SDK callback hook.
//
// The SDK wraps the underlying OAuth2 error in a generic AuthorizationError
// ("An error occurred during the authorization flow."). The real reason —
// invalid_grant / invalid_client / access_denied (e.g. an Action that threw
// post-login) — lives on `error.code` and `error.cause`. We surface it as
// Sentry `extra` so a callback failure identifies the root cause without
// digging through Auth0 dashboard logs.

export type Auth0ErrorDetail = {
  errorName?: string
  errorCode?: string
  causeName?: string
  causeCode?: string
  causeMessage?: string
}

const stringIfPresent = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined

export const extractAuth0Detail = (
  error: unknown,
): Auth0ErrorDetail | undefined => {
  if (!error || typeof error !== "object") return undefined
  const err = error as { name?: unknown; code?: unknown; cause?: unknown }
  const cause =
    err.cause && typeof err.cause === "object"
      ? (err.cause as {
          name?: unknown
          code?: unknown
          message?: unknown
        })
      : undefined
  const detail: Auth0ErrorDetail = {
    errorName: stringIfPresent(err.name),
    errorCode: stringIfPresent(err.code),
    causeName: stringIfPresent(cause?.name),
    causeCode: stringIfPresent(cause?.code),
    causeMessage: stringIfPresent(cause?.message),
  }
  return Object.values(detail).some((v) => v !== undefined) ? detail : undefined
}
