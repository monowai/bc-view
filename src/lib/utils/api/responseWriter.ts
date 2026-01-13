import { NextApiRequest, NextApiResponse } from "next"
import { BcApiError } from "@components/errors/bcApiError"

export async function handleErrors(response: Response): Promise<void> {
  let result: Record<string, unknown> = {}
  let rawBody = ""
  try {
    rawBody = await response.text()
    result = JSON.parse(rawBody)
  } catch {
    // Response body is not valid JSON - log it for debugging
    console.error(
      `[Backend Error] ${response.status} ${response.url}: ${rawBody || response.statusText}`,
    )
  }
  // Handle RFC 7807 problem detail format (detail) and legacy format (message/error)
  const errorMessage =
    (result.detail as string) ||
    (result.message as string) ||
    (result.error as string) ||
    rawBody ||
    response.statusText ||
    `HTTP ${response.status}`
  if (response.status == 401 || response.status == 403) {
    throw new BcApiError(
      response.status,
      errorMessage || "Auth error",
      response.statusText,
      (result.path as string) || (result.instance as string),
    )
  } else {
    throw new BcApiError(
      response.status,
      errorMessage,
      response.statusText,
      (result.path as string) || (result.instance as string),
      errorMessage,
    )
  }
}

/**
 * Check if an error is an Auth0 access token error
 */
function isAuth0TokenError(error: unknown): boolean {
  if (error instanceof Error) {
    const errorName = error.name?.toLowerCase() || ""
    const errorMessage = error.message?.toLowerCase() || ""
    // Auth0 SDK throws AccessTokenError when token is expired/invalid
    // Also check for common auth-related error messages
    return (
      errorName.includes("accesstokenerror") ||
      errorName.includes("accessdenied") ||
      errorMessage.includes("access token") ||
      errorMessage.includes("the user does not have a valid session") ||
      errorMessage.includes("login required") ||
      errorMessage.includes("consent required")
    )
  }
  if (typeof error === "object" && error !== null) {
    const err = error as Record<string, unknown>
    const code = (err.code as string)?.toLowerCase() || ""
    return (
      code === "access_token_expired" ||
      code === "invalid_token" ||
      code === "login_required"
    )
  }
  return false
}

export function fetchError(
  req: NextApiRequest,
  res: NextApiResponse,
  error: unknown,
): void {
  // Handle different error types gracefully
  let statusCode = 500
  let message = "An unexpected error occurred"
  let code = "INTERNAL_ERROR"
  let stack: string | undefined

  // Check for Auth0 token errors FIRST - return 401 to trigger re-auth
  if (isAuth0TokenError(error)) {
    statusCode = 401
    code = "AUTH_TOKEN_ERROR"
    message =
      error instanceof Error
        ? error.message
        : "Session expired. Please log in again."
  } else if (error instanceof BcApiError) {
    statusCode = error.statusCode
    message = error.message
    code = error.code || code
    stack = error.stack
  } else if (error instanceof Error) {
    message = error.message
    stack = error.stack
    // Check for common network errors
    if (error.message.includes("ECONNREFUSED")) {
      statusCode = 503
      code = "SERVICE_UNAVAILABLE"
      message = "Backend service is unavailable"
    } else if (error.message.includes("fetch failed")) {
      statusCode = 502
      code = "BAD_GATEWAY"
      message = "Failed to connect to backend service"
    }
  } else if (typeof error === "object" && error !== null) {
    const err = error as Record<string, unknown>
    statusCode = (err.statusCode as number) || statusCode
    message = (err.message as string) || message
    code = (err.code as string) || code
  }

  console.error(
    `[API Error] ${req.method} ${req.url} - ${statusCode}: ${message}`,
  )
  if (stack) {
    console.error(stack)
  }
  res.status(statusCode).json({ error: message, code, path: req.url })
}

export function hasError(response: Response): boolean {
  return response.status >= 400
}

export default async function handleResponse<T>(
  response: Response,
  res: NextApiResponse,
): Promise<void> {
  if (hasError(response)) {
    await handleErrors(response)
  } else if (response.status === 204) {
    // No content - just return the status
    res.status(204).end()
  } else {
    const json: T = await response.json()
    res.status(response.status || 200).json(json)
  }
}
