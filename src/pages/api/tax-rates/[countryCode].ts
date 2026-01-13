import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { TaxRateResponse } from "types/beancounter"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getDataUrl } from "@utils/api/bcConfig"
import { requestInit } from "@utils/api/fetchHelper"
import { NextApiRequest, NextApiResponse } from "next"

/**
 * API route for a specific tax rate by country code.
 * GET: Returns the tax rate for a specific country.
 * DELETE: Removes the tax rate for a specific country.
 */
export default withApiAuthRequired(async function taxRate(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { method, query } = req
    const { countryCode } = query
    const { accessToken } = await getAccessToken(req, res)

    if (!countryCode || typeof countryCode !== "string") {
      res.status(400).json({ error: "Country code is required" })
      return
    }

    const url = getDataUrl(`/tax-rates/${countryCode.toUpperCase()}`)

    switch (method?.toUpperCase()) {
      case "GET": {
        const response = await fetch(url, requestInit(accessToken, "GET", req))
        await handleResponse<TaxRateResponse>(response, res)
        break
      }
      case "DELETE": {
        const response = await fetch(
          url,
          requestInit(accessToken, "DELETE", req),
        )
        if (response.ok) {
          res.status(204).end()
        } else {
          await handleResponse<TaxRateResponse>(response, res)
        }
        break
      }
      default:
        res.setHeader("Allow", ["GET", "DELETE"])
        res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error: unknown) {
    fetchError(req, res, error)
  }
})
