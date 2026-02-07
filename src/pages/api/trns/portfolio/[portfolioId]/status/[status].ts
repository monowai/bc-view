import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const { portfolioId, status, tradeDate } = req.query
    let url = getDataUrl(`/trns/portfolio/${portfolioId}/status/${status}`)
    if (tradeDate) url += `?tradeDate=${tradeDate}`
    return url
  },
})
