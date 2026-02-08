import { auth0 } from "@lib/auth0"
import { requestInit } from "@utils/api/fetchHelper"
import { getDataUrl, getPositionsUrl } from "@utils/api/bcConfig"
import { fetchError } from "@utils/api/responseWriter"
import { NextApiRequest, NextApiResponse } from "next"
import { Asset, Portfolio, Position } from "types/beancounter"

const dataUrl = getDataUrl()
const positionUrl = getPositionsUrl()

interface AssetPosition {
  portfolio: Portfolio
  position: Position | null
  balance: number
}

interface AssetPositionsResponse {
  data: AssetPosition[]
}

// Response from bc-position endpoint
interface PositionResponse {
  data: {
    positions: Record<string, Position>
  }
}

// Response from portfolios/whereHeld endpoint
interface PortfoliosResponse {
  data: Portfolio[]
}

// Response from asset endpoint
interface AssetResponse {
  data: Asset
}

/**
 * Get positions for a specific asset across all portfolios where it's held.
 * GET /api/assets/{id}/positions?date=today
 *
 * Pattern (same as svc-event):
 * 1. Resolve the asset by calling /assets/{id}
 * 2. Use the resolved asset's ID to call whereHeld
 *
 * Returns portfolios that hold the asset along with the current position/balance.
 */
export default async function getAssetPositions(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"])
    res.status(405).json({ error: "Method not allowed" })
    return
  }

  try {
    const session = await auth0.getSession(req)
    if (!session) {
      res.status(401).json({ error: "Not authenticated" })
      return
    }

    const { token: accessToken } = await auth0.getAccessToken(req, res)
    const assetId = req.query.id as string
    const date = (req.query.date as string) || "today"

    // Step 1: Resolve asset and call whereHeld in parallel
    const [assetResponse, whereHeldResponse] = await Promise.all([
      fetch(
        `${dataUrl}/assets/${assetId}`,
        requestInit(accessToken, "GET", req),
      ),
      fetch(
        `${dataUrl}/portfolios/asset/${assetId}?asAt=${date}`,
        requestInit(accessToken, "GET", req),
      ),
    ])

    if (!assetResponse.ok) {
      if (assetResponse.status === 404) {
        res.status(200).json({ data: [] })
        return
      }
      res.status(assetResponse.status).json({
        error: `Failed to resolve asset: ${assetResponse.status}`,
      })
      return
    }

    const assetData: AssetResponse = await assetResponse.json()
    const resolvedAssetId = assetData.data?.id || assetId

    // Step 2: Check whereHeld results
    let portfolios: Portfolio[] = []
    if (whereHeldResponse.ok) {
      const whereHeldData: PortfoliosResponse = await whereHeldResponse.json()
      portfolios = whereHeldData.data || []
    }

    // If whereHeld returns empty (can happen for ACCOUNT assets where asset.id == cashAsset.id),
    // fall back to scanning all portfolios for positions
    if (portfolios.length === 0) {
      const allPortfoliosResponse = await fetch(
        `${dataUrl}/portfolios`,
        requestInit(accessToken, "GET", req),
      )

      if (!allPortfoliosResponse.ok) {
        res.status(200).json({ data: [] })
        return
      }

      const allPortfoliosData: PortfoliosResponse =
        await allPortfoliosResponse.json()
      const allPortfolios: Portfolio[] = allPortfoliosData.data || []

      // Scan each portfolio for this asset's position
      const foundPositions: AssetPosition[] = []
      await Promise.all(
        allPortfolios.map(async (portfolio): Promise<void> => {
          try {
            const holdingsResponse = await fetch(
              `${positionUrl}/${portfolio.code}?asAt=${date}&value=true`,
              requestInit(accessToken, "GET", req),
            )

            if (!holdingsResponse.ok) return

            const holdingsData: PositionResponse = await holdingsResponse.json()
            const positions = holdingsData.data?.positions || {}

            const position = Object.values(positions).find(
              (pos: Position) => pos.asset?.id === resolvedAssetId,
            )

            if (position) {
              foundPositions.push({
                portfolio,
                position,
                balance: position.quantityValues?.total || 0,
              })
            }
          } catch (error) {
            console.error(`Error scanning portfolio ${portfolio.code}:`, error)
          }
        }),
      )

      res.status(200).json({ data: foundPositions })
      return
    }

    // Step 3: For each portfolio, fetch holdings and find the asset's position
    const assetPositions: AssetPosition[] = await Promise.all(
      portfolios.map(async (portfolio): Promise<AssetPosition> => {
        try {
          const holdingsResponse = await fetch(
            `${positionUrl}/${portfolio.code}?asAt=${date}&value=true`,
            requestInit(accessToken, "GET", req),
          )

          if (!holdingsResponse.ok) {
            return {
              portfolio,
              position: null,
              balance: 0,
            }
          }

          const holdingsData: PositionResponse = await holdingsResponse.json()
          const positions = holdingsData.data?.positions || {}

          // Find the position for this asset (match by resolved ID)
          const position = Object.values(positions).find(
            (pos: Position) => pos.asset?.id === resolvedAssetId,
          )

          return {
            portfolio,
            position: position || null,
            balance: position?.quantityValues?.total || 0,
          }
        } catch (error) {
          console.error(`Error fetching holdings for ${portfolio.code}:`, error)
          return {
            portfolio,
            position: null,
            balance: 0,
          }
        }
      }),
    )

    const response: AssetPositionsResponse = {
      data: assetPositions,
    }

    res.status(200).json(response)
  } catch (error: unknown) {
    fetchError(req, res, error)
  }
}
