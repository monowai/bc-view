import { auth0 } from "@lib/auth0"
import { fetchError, hasError, handleErrors } from "@utils/api/responseWriter"
import { getDataUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"
import { AssetResponse } from "types/beancounter"

const importUrl = getDataUrl("/assets/me/import")

export default async function importAssets(
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
    const { method, body } = req

    if (method?.toUpperCase() !== "POST") {
      res.setHeader("Allow", ["POST"])
      res.status(405).end(`Method ${method} Not Allowed`)
      return
    }

    const csvContent = body?.csvContent
    if (!csvContent) {
      res.status(400).json({ error: "No CSV content provided" })
      return
    }

    const formData = new FormData()
    formData.append(
      "file",
      new Blob([csvContent], { type: "text/csv" }),
      "assets.csv",
    )

    const response = await fetch(importUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    })

    if (hasError(response)) {
      await handleErrors(response)
    } else {
      const json: AssetResponse = await response.json()
      res.status(response.status || 200).json(json)
    }
  } catch (error: unknown) {
    fetchError(req, res, error)
  }
}
