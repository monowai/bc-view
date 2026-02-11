import {
  createApiHandler,
  sanitizePathParam,
} from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const trades = req.query.trades as string[]
    const portfolioId = sanitizePathParam(trades[0], "portfolioId")
    if (req.method === "DELETE") {
      return getDataUrl(`/trns/${portfolioId}`)
    }
    const assetId = sanitizePathParam(trades[1], "assetId")
    return getDataUrl(`/trns/${portfolioId}/asset/${assetId}/trades`)
  },
  methods: ["GET", "DELETE"],
})
