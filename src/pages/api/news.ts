import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const { tickers, market } = req.query
    const params = new URLSearchParams({ tickers: tickers as string })
    if (market && typeof market === "string") {
      params.append("market", market)
    }
    return getDataUrl(`/news?${params.toString()}`)
  },
})
