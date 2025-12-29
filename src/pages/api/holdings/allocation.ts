import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse from "@utils/api/responseWriter"
import { AllocationResponse } from "types/beancounter"
import { getPositionsUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"

const baseUrl = getPositionsUrl()

export default withApiAuthRequired(async function allocation(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { accessToken } = await getAccessToken(req, res)
    const asAt = (req.query.asAt as string) || "today"
    const ids = req.query.ids as string | undefined

    // Build URL with optional ids parameter
    let url = `${baseUrl}/allocation/${asAt}`
    if (ids) {
      url += `?ids=${encodeURIComponent(ids)}`
    }

    const response = await fetch(url, requestInit(accessToken, "GET", req))

    if (!response.ok) {
      const msg = `Failed to fetch allocation: ${response.status}`
      console.error(msg)
      res.status(response.status).json({
        status: "error",
        message: msg,
      })
      return
    }

    await handleResponse<AllocationResponse>(response, res)
  } catch (error: any) {
    console.error(error)
    res.status(error.status || 500).json({
      status: "error",
      message:
        error.message ||
        "An unexpected error occurred while obtaining allocation data.",
    })
  }
})
