import { auth0 } from "@lib/auth0"
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

export default async function holdingsWeights(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"])
    res.status(405).end(`Method ${req.method} Not Allowed`)
    return
  }

  try {
    const session = await auth0.getSession(req)
    if (!session) {
      res.status(401).json({ error: "Not authenticated" })
      return
    }

    const { token: accessToken } = await auth0.getAccessToken(req, res)
    const portfolioIds = req.query.portfolioIds as string

    if (!portfolioIds) {
      res.status(400).json({ error: "portfolioIds query parameter required" })
      return
    }

    // Strict allowlist for portfolio codes — anything outside this charset
    // could path-traverse or otherwise inject into the upstream fetch URL
    // (CWE-918). Validation happens both upfront and inline-at-the-sink so
    // Snyk's taint tracker sees the guard immediately before each fetch().
    const PORTFOLIO_CODE_RE = /^[A-Za-z0-9_-]{1,32}$/

    const rawCodes = portfolioIds.split(",").filter(Boolean)
    if (rawCodes.length === 0) {
      res.status(400).json({ error: "At least one portfolio code required" })
      return
    }

    // Build a fully-validated array; if any entry fails the allowlist, abort
    // with 400 before any network call is made. The new array is a fresh
    // binding so downstream uses can be tracked as sanitised values.
    const codes: string[] = []
    for (const code of rawCodes) {
      if (!PORTFOLIO_CODE_RE.test(code)) {
        res.status(400).json({ error: "Invalid portfolio code format" })
        return
      }
      codes.push(code)
    }

    // Fetch holdings for each portfolio
    const assetValues: Record<
      string,
      {
        assetId: string
        assetCode: string
        assetName: string
        value: number
        price?: number
        priceCurrency?: string
      }
    > = {}
    let totalValue = 0
    let currency = "USD"

    for (const portfolioCode of codes) {
      // Defence in depth: every loop iteration re-tests the value against
      // the allowlist immediately before constructing the URL, so a future
      // edit that introduces an unsanitised path can't slip through.
      if (!PORTFOLIO_CODE_RE.test(portfolioCode)) {
        res.status(400).json({ error: "Invalid portfolio code format" })
        return
      }

      // Get today's holdings for this portfolio
      const today = new Date().toISOString().split("T")[0]
      const holdingsUrl = getPositionsUrl(`/${portfolioCode}/${today}`)

      // deepcode ignore Ssrf: portfolioCode is validated against
      // PORTFOLIO_CODE_RE on every iteration above; the URL host comes from
      // server-side config (getPositionsUrl) and only the path component is
      // user-influenced, restricted to [A-Za-z0-9_-]{1,32}.
      const response = await fetch(
        holdingsUrl,
        requestInit(accessToken, "GET", req),
      )

      if (!response.ok) {
        console.error(
          `[weights] Failed to fetch holdings for portfolio ${portfolioCode}: ${response.status}`,
        )
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
        const value =
          position.moneyValues?.[VALUE_IN_OPTIONS.PORTFOLIO]?.marketValue || 0
        if (value <= 0) continue

        const assetId = asset.id

        // Get price from TRADE money values (price in trade currency)
        const tradeMoneyValues = position.moneyValues?.[VALUE_IN_OPTIONS.TRADE]
        const price = tradeMoneyValues?.priceData?.close
        const priceCurrency =
          tradeMoneyValues?.currency?.code || asset.market?.currency?.code

        if (assetValues[assetId]) {
          assetValues[assetId].value += value
          // Keep the most recent price if already exists
          if (price && !assetValues[assetId].price) {
            assetValues[assetId].price = price
            assetValues[assetId].priceCurrency = priceCurrency
          }
        } else {
          // Build asset code: omit "US:" prefix for US market (default)
          const marketCode = asset.market?.code
          const code = asset.code || assetId
          const fullCode =
            marketCode && marketCode !== "US" ? `${marketCode}:${code}` : code

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

    res.status(200).json(result)
  } catch (error: unknown) {
    fetchError(req, res, error)
  }
}
