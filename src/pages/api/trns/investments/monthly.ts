import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const params = new URLSearchParams()
    const { yearMonth, currency, portfolioIds } = req.query
    if (yearMonth) params.append("yearMonth", yearMonth as string)
    if (currency) params.append("currency", currency as string)
    if (portfolioIds) params.append("portfolioIds", portfolioIds as string)
    const qs = params.toString()
    return getDataUrl(`/trns/investments/monthly${qs ? `?${qs}` : ""}`)
  },
})
