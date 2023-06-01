import { NextApiRequest, NextApiResponse } from "next";
import { BcApiError } from "@core/errors/bcApiError";

export async function handleErrors(response: Response): Promise<void> {
  const result: BcApiError = await response.json();
  if (response.status == 401 || response.status == 403) {
    throw new BcApiError(
      response.status,
      "Auth error",
      response.statusText,
      result.path
    );
  } else {
    throw new BcApiError(
      response.status,
      result.message,
      response.statusText,
      result.path,
      result.message
    );
  }
}

export function fetchError(
  res: NextApiResponse,
  req: NextApiRequest,
  error: any
): void {
  const apiError = new BcApiError(
    error.statusCode,
    error.message,
    error.code,
    req.url,
    error.stack
  );
  console.error(apiError);
  res.status(apiError.statusCode).json(apiError);
}

export function hasError(response: Response): boolean {
  return response.status >= 400;
}

export default async function handleResponse<T>(
  response: Response,
  res: NextApiResponse
): Promise<void> {
  if (hasError(response)) {
    await handleErrors(response);
  } else {
    const json: T = await response.json();
    res.status(response.status || 200).json(json);
  }
}
