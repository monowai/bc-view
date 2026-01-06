import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { getDataUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"

/**
 * PATCH /api/trns/patch/{portfolioId}/{trnId}
 * Updates a transaction with new data.
 * Request body: TrnInput (partial - only provided fields are updated)
 */
export default withApiAuthRequired(async function patchTransaction(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { accessToken } = await getAccessToken(req, res)
    const { method } = req
    const { portfolioId, trnId } = req.query as {
      portfolioId: string
      trnId: string
    }

    if (method?.toUpperCase() !== "PATCH") {
      res.setHeader("Allow", ["PATCH"])
      res.status(405).end(`Method ${method} Not Allowed`)
      return
    }

    const url = getDataUrl(`/trns/${portfolioId}/${trnId}`)
    const response = await fetch(url, {
      ...requestInit(accessToken, "PATCH", req),
      body: JSON.stringify(req.body),
    })
    await handleResponse(response, res)
  } catch (error: unknown) {
    fetchError(res, req, error)
  }
})
