import { createApiHandler } from "@utils/api/createApiHandler"
import { getPositionsUrl } from "@utils/api/bcConfig"

/**
 * Proxy for svc-position `GET /net-worth`. The headline (total, gain on
 * day, healthcare reserve, classification and per-portfolio breakdowns) is
 * computed there, already in `currency`; the browser only renders it.
 */
export default createApiHandler({
  url: (req) => {
    const asAt = (req.query.asAt as string) || "today"
    const ids = req.query.ids as string | undefined
    const codes = req.query.codes as string | undefined
    const currency = req.query.currency as string | undefined
    let url = getPositionsUrl(`/net-worth?asAt=${asAt}`)
    if (ids) url += `&ids=${encodeURIComponent(ids)}`
    if (codes) url += `&codes=${encodeURIComponent(codes)}`
    if (currency) url += `&currency=${encodeURIComponent(currency)}`
    return url
  },
})
