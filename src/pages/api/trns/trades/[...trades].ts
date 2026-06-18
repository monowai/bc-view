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
    // Next.js gives string[] when the param repeats (?portfolios=a&portfolios=b),
    // so normalise to a single comma string before splitting.
    const portfoliosRaw = req.query.portfolios
    const portfolios = Array.isArray(portfoliosRaw)
      ? portfoliosRaw.join(",")
      : portfoliosRaw
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
