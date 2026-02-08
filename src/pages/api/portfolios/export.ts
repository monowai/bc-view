import { auth0 } from "@lib/auth0"
import { requestInit } from "@utils/api/fetchHelper"
import { fetchError } from "@utils/api/responseWriter"
import { getDataUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"

const exportUrl = getDataUrl("/portfolios/export")

export default async function exportPortfolios(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  try {
    const session = await auth0.getSession(req)
    if (!session) {
      res.status(401).json({ error: "Not authenticated" })
      return
    }

    const { token: accessToken } = await auth0.getAccessToken(req, res)
    const { method } = req

    if (method?.toUpperCase() !== "GET") {
      res.setHeader("Allow", ["GET"])
      res.status(405).end(`Method ${method} Not Allowed`)
      return
    }

    const response = await fetch(
      exportUrl,
      requestInit(accessToken, "GET", req),
    )

    if (!response.ok) {
      res.status(response.status).json({ error: "Export failed" })
      return
    }

    const csvContent = await response.text()
    res.setHeader("Content-Type", "text/csv")
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="portfolios.csv"',
    )
    res.status(200).send(csvContent)
  } catch (error: unknown) {
    fetchError(req, res, error)
  }
}
