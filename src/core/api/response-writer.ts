import { NextApiResponse } from "next";

export function handleErrors(response: Response, res: NextApiResponse): void {
  if (response.status == 401 || response.status == 403) {
    res.status(response.status).json('{"error": "auth error"}');
  } else {
    res.status(response.status).json(response.json());
  }
}

export function hasError(response: Response): boolean {
  return response.status >= 300;
}

export default async function handleResponse<T>(
  response: Response,
  res: NextApiResponse
): Promise<void> {
  if (hasError(response)) {
    handleErrors(response, res);
  } else {
    const json: T = await response.json();
    res.status(response.status || 200).json(json);
  }
}
