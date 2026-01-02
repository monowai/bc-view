import { NextApiRequest, NextApiResponse } from "next"
import { BcApiError } from "@components/errors/bcApiError"

export async function handleErrors(response: Response): Promise<void> {
  const result = await response.json()
  // Handle RFC 7807 problem detail format (detail) and legacy format (message)
  const errorMessage = result.detail || result.message || response.statusText
  if (response.status == 401 || response.status == 403) {
    throw new BcApiError(
      response.status,
      "Auth error",
      response.statusText,
      result.path || result.instance,
    )
  } else {
    throw new BcApiError(
      response.status,
      errorMessage,
      response.statusText,
      result.path || result.instance,
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
  } else {
    const json: T = await response.json()
    res.status(response.status || 200).json(json)
  }
}
