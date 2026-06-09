import { createApiHandler } from "@utils/api/createApiHandler"
import { getPositionsUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const asAt = (req.query.asAt as string) || "today"
    const ids = req.query.ids as string | undefined
    const currency = req.query.currency as string | undefined
    let url = getPositionsUrl(`/allocation?asAt=${asAt}`)
    if (ids) url += `&ids=${encodeURIComponent(ids)}`
    // Forward currency so svc-position's aggregator adopts it on the
    // synthesised context portfolio (beancounter PR #934). Without this
    // the allocation response stays in the first portfolio's currency
    // and convertCurrency (#935) has to FX-scale — both compositeLiquid /
    // compositeNonLiquid and totalValue then arrive in the wrong currency.
    if (currency) url += `&currency=${encodeURIComponent(currency)}`
    return url
  },
})
