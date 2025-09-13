import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@lib/api/fetchHelper"
import handleResponse from "@lib/api/responseWriter"
import { HoldingContract } from "types/beancounter"
import { getPositionsUrl } from "@lib/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"

const baseUrl = getPositionsUrl()

export default withApiAuthRequired(async function holdingsByCodeAsAt(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { accessToken } = await getAccessToken(req, res)
    const {
      query: { code, asAt },
    } = req

    const response = await fetch(
      `${baseUrl}/${code}/${asAt}`,
      requestInit(accessToken),
    )

    if (!response.ok) {
      const msg = `Failed to fetch holdings: ${response.status}`
      console.error(msg) // Log the error for debugging
      res.status(response.status).json({
        status: "error",
        message: `${msg}`,
      })
      return
    }

    await handleResponse<HoldingContract>(response, res)
  } catch (error: any) {
    console.error(error) // Log the error for debugging
    res.status(error.status).json({
      status: "error",
      message:
        error.message ||
        "An unexpected error occurred while obtaining the holdings.",
    })
  }
})
