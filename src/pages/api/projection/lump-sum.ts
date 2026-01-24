import { NextApiRequest, NextApiResponse } from "next"
import { withApiAuthRequired, getAccessToken } from "@auth0/nextjs-auth0"
import { getRetireUrl } from "@utils/api/bcConfig"

interface LumpSumProjectionRequest {
  monthlyContribution: number
  expectedReturnRate: number
  currentAge: number
  payoutAge: number
}

interface LumpSumProjection {
  projectedPayout: number
  totalContributions: number
  interestEarned: number
  yearsToMaturity: number
}

interface LumpSumProjectionResponse {
  data: LumpSumProjection
}

export default withApiAuthRequired(async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    const { accessToken } = await getAccessToken(req, res)
    const body: LumpSumProjectionRequest = req.body

    const response = await fetch(getRetireUrl("/projection/lump-sum"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Lump sum projection failed:", response.status, errorText)
      return res.status(response.status).json({ error: "Projection failed" })
    }

    const data: LumpSumProjectionResponse = await response.json()
    return res.status(200).json(data)
  } catch (error) {
    console.error("Lump sum projection error:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
})
