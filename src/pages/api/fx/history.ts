import { NextApiRequest, NextApiResponse } from "next"
import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { getDataUrl } from "@utils/api/bcConfig"
import { fetchError } from "@utils/api/responseWriter"

export interface FxHistoryResponse {
  from: string
  to: string
  startDate: string
  endDate: string
  data: Array<{ date: string; rate: number }>
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<FxHistoryResponse | { error: string }>,
): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }

  const { from, to, months = "3" } = req.query

  if (!from || !to || typeof from !== "string" || typeof to !== "string") {
    res.status(400).json({ error: "Missing from or to currency" })
    return
  }

  try {
    // Get access token for backend call
    const { accessToken } = await getAccessToken(req, res)

    // Call bc-data backend for historical rates from our database
    const url = getDataUrl(`/fx/history?from=${from}&to=${to}&months=${months}`)

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      console.error("FX history backend error:", response.status)
      res
        .status(response.status)
        .json({ error: `Backend error: ${response.status}` })
      return
    }

    const data = await response.json()

    res.status(200).json(data)
  } catch (error: unknown) {
    fetchError(req, res, error)
  }
}

export default withApiAuthRequired(handler)
