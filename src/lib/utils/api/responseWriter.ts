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

export function fetchError(
  res: NextApiResponse,
  req: NextApiRequest,
  error: unknown,
): void {
  // Handle different error types gracefully
  let statusCode = 500
  let message = "An unexpected error occurred"
  let code = "INTERNAL_ERROR"
  let stack: string | undefined

  if (error instanceof BcApiError) {
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

  console.error(`[API Error] ${req.method} ${req.url} - ${statusCode}: ${message}`)
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
