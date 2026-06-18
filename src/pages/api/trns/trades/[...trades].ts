import {
  createApiHandler,
  sanitizePathParam,
} from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"
import { transformTrnEnvelopeJson } from "@utils/trns/trnsSelectors"

export default createApiHandler({
  url: (req) => {
    const trades = req.query.trades as string[]
    // Aggregated drill-down: /api/trns/trades/{assetId}?portfolios=a,b
    const portfolios = req.query.portfolios as string | undefined
    if (portfolios && req.method !== "DELETE") {
      const assetId = sanitizePathParam(trades[0], "assetId")
      const portfolioIds = portfolios
        .split(",")
        .map((id) => sanitizePathParam(id, "portfolioId"))
      return getDataUrl(
        `/trns/asset/${assetId}/trades?portfolios=${encodeURIComponent(
          portfolioIds.join(","),
        )}`,
      )
    }
    const portfolioId = sanitizePathParam(trades[0], "portfolioId")
    if (req.method === "DELETE") {
      return getDataUrl(`/trns/${portfolioId}`)
    }
    const assetId = sanitizePathParam(trades[1], "assetId")
    return getDataUrl(`/trns/${portfolioId}/asset/${assetId}/trades`)
  },
  methods: ["GET", "DELETE"],
  transformJson: transformTrnEnvelopeJson,
})
