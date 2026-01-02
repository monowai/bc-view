import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse from "@utils/api/responseWriter"
import { HoldingContract } from "types/beancounter"
import { getPositionsUrl } from "@utils/api/bcConfig"
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
      `${baseUrl}/${code}?asAt=${asAt}`,
      requestInit(accessToken, "GET", req),
    )

    if (!response.ok) {
      const msg = `Failed to fetch holdings: ${response.status}`
      console.error(msg)
      res.status(response.status).json({
        status: "error",
        message: `${msg}`,
      })
      return
    }

    await handleResponse<HoldingContract>(response, res)
  } catch (error: any) {
    console.error(error)
    res.status(error.status || 500).json({
      status: "error",
      message:
        error.message ||
        "An unexpected error occurred while obtaining the holdings.",
    })
  }
})
