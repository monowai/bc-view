import { NextApiRequest, NextApiResponse } from "next"
import { BcApiError } from "@components/errors/bcApiError"

export async function handleErrors(response: Response): Promise<void> {
  let result: Record<string, unknown> = {}
  try {
    result = await response.json()
  } catch {
    // Response body is not valid JSON - use status text
  }
  // Handle RFC 7807 problem detail format (detail) and legacy format (message)
  const errorMessage =
    (result.detail as string) ||
    (result.message as string) ||
    response.statusText
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
  error: any,
): void {
  const apiError = new BcApiError(
    error.statusCode,
    error.message,
    error.code,
    req.url,
    error.stack,
  )
  console.error(apiError)
  res.status(apiError.statusCode).json(apiError)
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
