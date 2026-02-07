import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const { months, endMonth, portfolioIds, groupBy } = req.query
    const params = new URLSearchParams()
    if (months) params.append("months", months as string)
    if (endMonth) params.append("endMonth", endMonth as string)
    if (portfolioIds) params.append("portfolioIds", portfolioIds as string)
    if (groupBy) params.append("groupBy", groupBy as string)
    const qs = params.toString()
    return getDataUrl(`/trns/income/monthly${qs ? `?${qs}` : ""}`)
  },
})
