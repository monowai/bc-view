import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const params = new URLSearchParams()
    const { days, currency, portfolioIds } = req.query
    if (days) params.append("days", days as string)
    if (currency) params.append("currency", currency as string)
    if (portfolioIds) params.append("portfolioIds", portfolioIds as string)
    const qs = params.toString()
    return getDataUrl(`/trns/investments/monthly${qs ? `?${qs}` : ""}`)
  },
})
