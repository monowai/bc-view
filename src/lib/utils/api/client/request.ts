/**
 * Shared plumbing for the browser-side API modules in this folder
 * (`@utils/api/client/<domain>`). Each domain module owns its `/api/...`
 * URLs, SWR keys and request shapes; this file holds the few pieces they
 * all need.
 */

/** A failed API call, keeping the HTTP status so callers can branch on it. */
export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

/**
 * The reason a failed response gives, read from the BFF's JSON envelope
 * (`{ error, message, code }`, see responseWriter): `message`, then `error`.
 * `undefined` when the body is empty, not JSON, or names no reason, so the
 * caller's own fallback text applies.
 */
export async function readServerMessage(
  res: Response,
): Promise<string | undefined> {
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    error?: string
  } | null
  return data?.message || data?.error || undefined
}

/** RequestInit for a JSON request; the body is omitted when undefined. */
export function jsonInit(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }
}
