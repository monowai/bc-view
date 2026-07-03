import { auth0 } from "@lib/auth0"
import { requestInit } from "@utils/api/fetchHelper"
import { fetchError, hasError, handleErrors } from "@utils/api/responseWriter"
import { NextApiHandler } from "next"

/**
 * Factory for CSV export API route handlers.
 * Proxies a GET request to upstreamUrl and streams the response as a CSV download.
 */
export function createCsvExportHandler(
  upstreamUrl: string,
  filename: string,
): NextApiHandler {
  return async (req, res) => {
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
        upstreamUrl,
        requestInit(accessToken, "GET", req),
      )

      if (!response.ok) {
        res.status(response.status).json({ error: "Export failed" })
        return
      }

      const csvContent = await response.text()
      res.setHeader("Content-Type", "text/csv")
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)
      res.status(200).send(csvContent)
    } catch (error: unknown) {
      fetchError(req, res, error)
    }
  }
}

/**
 * Factory for CSV import API route handlers.
 * Accepts a POST with { csvContent } in the body, uploads to upstreamUrl as multipart FormData,
 * and passes through the JSON response of type T.
 */
export function createCsvImportHandler<T>(
  upstreamUrl: string,
  filename: string,
): NextApiHandler {
  return async (req, res) => {
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
        filename,
      )

      const response = await fetch(upstreamUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      })

      if (hasError(response)) {
        await handleErrors(response)
      } else {
        const json: T = await response.json()
        res.status(response.status || 200).json(json)
      }
    } catch (error: unknown) {
      fetchError(req, res, error)
    }
  }
}
