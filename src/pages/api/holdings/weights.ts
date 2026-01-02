import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import { fetchError } from "@utils/api/responseWriter"
import { getPositionsUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"
import { VALUE_IN_OPTIONS } from "types/constants"
import { getReportCategory, REPORT_CATEGORIES } from "@utils/categoryMapping"

interface HoldingWeight {
  assetId: string
  assetCode: string
  assetName: string
  weight: number
  value: number
  price?: number
  priceCurrency?: string
}

interface WeightsResponse {
  weights: HoldingWeight[]
  totalValue: number
  currency: string
}

export default withApiAuthRequired(async function holdingsWeights(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"])
    return res.status(405).end(`Method ${req.method} Not Allowed`)
  }

  try {
    const { accessToken } = await getAccessToken(req, res)
    const portfolioIds = req.query.portfolioIds as string

    if (!portfolioIds) {
      return res.status(400).json({ error: "portfolioIds query parameter required" })
    }

    const codes = portfolioIds.split(",").filter(Boolean)
    if (codes.length === 0) {
      return res.status(400).json({ error: "At least one portfolio code required" })
    }

    // Fetch holdings for each portfolio
    const assetValues: Record<string, {
      assetId: string
      assetCode: string
      assetName: string
      value: number
      price?: number
      priceCurrency?: string
    }> = {}
    let totalValue = 0
    let currency = "USD"

    for (const portfolioCode of codes) {
      // Get today's holdings for this portfolio
      const today = new Date().toISOString().split("T")[0]
      const holdingsUrl = getPositionsUrl(`/${portfolioCode}/${today}`)

      const response = await fetch(holdingsUrl, requestInit(accessToken, "GET", req))

      if (!response.ok) {
        console.error(`[weights] Failed to fetch holdings for portfolio ${portfolioCode}: ${response.status}`)
        continue
      }

      const holdingData = await response.json()
      const positionsRecord = holdingData.data?.positions || {}
      currency = holdingData.data?.portfolio?.currency?.code || currency

      // Aggregate positions by asset (positions is a Record, not an array)
      // Exclude cash positions - weights are calculated on non-cash assets only
      for (const position of Object.values(positionsRecord) as any[]) {
        const asset = position.asset
        if (!asset?.id) continue

        // Skip cash positions (currencies, bank accounts, etc.)
        if (getReportCategory(asset) === REPORT_CATEGORIES.CASH) continue

        // Use marketValue in portfolio currency
        const value = position.moneyValues?.[VALUE_IN_OPTIONS.PORTFOLIO]?.marketValue || 0
        if (value <= 0) continue

        const assetId = asset.id

        // Get price from TRADE money values (price in trade currency)
        const tradeMoneyValues = position.moneyValues?.[VALUE_IN_OPTIONS.TRADE]
        const price = tradeMoneyValues?.priceData?.close
        const priceCurrency = tradeMoneyValues?.currency?.code || asset.market?.currency?.code

        if (assetValues[assetId]) {
          assetValues[assetId].value += value
          // Keep the most recent price if already exists
          if (price && !assetValues[assetId].price) {
            assetValues[assetId].price = price
            assetValues[assetId].priceCurrency = priceCurrency
          }
        } else {
          // Build MARKET:CODE format (e.g., NASDAQ:VOO)
          const marketCode = asset.market?.code
          const code = asset.code || assetId
          const fullCode = marketCode ? `${marketCode}:${code}` : code

          assetValues[assetId] = {
            assetId,
            assetCode: fullCode,
            assetName: asset.name || asset.code || assetId,
            value,
            price,
            priceCurrency,
          }
        }
        totalValue += value
      }
    }

    // Calculate weights as decimals (0.0 - 1.0)
    const weights: HoldingWeight[] = Object.values(assetValues)
      .map((asset) => ({
        assetId: asset.assetId,
        assetCode: asset.assetCode,
        assetName: asset.assetName,
        value: asset.value,
        weight: totalValue > 0 ? asset.value / totalValue : 0,
        price: asset.price,
        priceCurrency: asset.priceCurrency,
      }))
      .filter((w) => w.weight > 0.001) // Filter out tiny positions < 0.1%
      .sort((a, b) => b.weight - a.weight) // Sort by weight descending

    const result: WeightsResponse = {
      weights,
      totalValue,
      currency,
    }

    return res.status(200).json(result)
  } catch (error: unknown) {
    return fetchError(res, req, error)
  }
})
