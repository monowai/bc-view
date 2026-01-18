import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { getDataUrl } from "@utils/api/bcConfig"
import { fetchError } from "@utils/api/responseWriter"
import { requestInit } from "@utils/api/fetchHelper"
import { NextApiRequest, NextApiResponse } from "next"

export const baseUrl = getDataUrl("/trns")

export default withApiAuthRequired(async function trnsApi(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { accessToken } = await getAccessToken(req, res)

    if (req.method === "POST") {
      console.log("POST /trns - creating transactions")
      console.log("Request body:", JSON.stringify(req.body, null, 2))
      const response = await fetch(baseUrl, {
        ...requestInit(accessToken, "POST", req),
        body: JSON.stringify(req.body),
      })
      const responseData = await response.json()
      console.log("Response status:", response.status)
      console.log("Response data:", JSON.stringify(responseData, null, 2))
      res.status(response.status).json(responseData)
    } else {
      res.setHeader("Allow", ["POST"])
      res.status(405).end(`Method ${req.method} Not Allowed`)
    }
  } catch (error: unknown) {
    fetchError(req, res, error)
  }
})
