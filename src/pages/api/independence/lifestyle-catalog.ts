import { NextApiRequest } from "next"
import { createApiHandler } from "@utils/api/createApiHandler"
import { getRetireUrl } from "@utils/api/bcConfig"

/**
 * Forward the plan's `expensesCurrency` through to svc-retire so the
 * catalog can be returned pre-converted for that currency (svc-retire
 * #170). The frontend never converts/reformats amounts itself — it's a
 * pure pass-through of whatever `currency` the response echoes back.
 */
function catalogUrl(req: NextApiRequest): string {
  const base = getRetireUrl("/lifestyle/catalog")
  const raw = req.query.currency
  const currency = Array.isArray(raw) ? raw[0] : raw
  return currency ? `${base}?currency=${encodeURIComponent(currency)}` : base
}

export default createApiHandler({
  url: catalogUrl,
})
