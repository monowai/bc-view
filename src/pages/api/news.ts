import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"
import { BcApiError } from "@components/errors/bcApiError"

export default createApiHandler({
  url: (req) => {
    const { tickers, market } = req.query
    if (typeof tickers !== "string" || !tickers) {
      throw new BcApiError(400, "tickers is required", "Bad Request", undefined)
    }
    const params = new URLSearchParams({ tickers })
    if (market && typeof market === "string") {
      params.append("market", market)
    }
    return getDataUrl(`/news?${params.toString()}`)
  },
})
