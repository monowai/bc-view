import { createApiHandler } from "@utils/api/createApiHandler"
import { getPositionsUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const asAt = (req.query.asAt as string) || "today"
    const codes = req.query.codes as string | undefined
    const currency = req.query.currency as string | undefined
    let url = getPositionsUrl(`/aggregated?asAt=${asAt}`)
    if (codes) url += `&codes=${encodeURIComponent(codes)}`
    if (currency) url += `&currency=${encodeURIComponent(currency)}`
    return url
  },
})
