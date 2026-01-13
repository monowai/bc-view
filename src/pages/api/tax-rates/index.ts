import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import {
  TaxRatesResponse,
  TaxRateResponse,
  TaxRateRequest,
} from "types/beancounter"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getDataUrl } from "@utils/api/bcConfig"
import { requestInit } from "@utils/api/fetchHelper"
import { NextApiRequest, NextApiResponse } from "next"

const baseUrl = getDataUrl("/tax-rates")

/**
 * API route for user tax rates.
 * GET: Returns all tax rates for the current user.
 * POST: Creates or updates a tax rate for a country.
 */
export default withApiAuthRequired(async function taxRates(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { method, body } = req
    const { accessToken } = await getAccessToken(req, res)

    switch (method?.toUpperCase()) {
      case "GET": {
        const response = await fetch(
          baseUrl,
          requestInit(accessToken, "GET", req),
        )
        await handleResponse<TaxRatesResponse>(response, res)
        break
      }
      case "POST": {
        const taxRateRequest: TaxRateRequest = body
        const response = await fetch(baseUrl, {
          ...requestInit(accessToken, "POST", req),
          body: JSON.stringify(taxRateRequest),
        })
        await handleResponse<TaxRateResponse>(response, res)
        break
      }
      default:
        res.setHeader("Allow", ["GET", "POST"])
        res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error: unknown) {
    fetchError(req, res, error)
  }
})
