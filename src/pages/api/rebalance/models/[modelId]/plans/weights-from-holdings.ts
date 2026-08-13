import {
  createApiHandler,
  sanitizePathParam,
} from "@utils/api/createApiHandler"
import { getRebalanceUrl } from "@utils/api/bcConfig"

// Next.js req.query values are string | string[] | undefined. Forwarding the
// raw value to encodeURIComponent collapses arrays to "v1,v2" and undefined
// to "undefined" — neither is what svc-rebalance wants. Pick the first
// element of arrays, treat undefined as the empty string, so the upstream
// gets canonical scalar query params.
function asScalar(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ""
  return value ?? ""
}

export default createApiHandler({
  url: (req) => {
    const modelId = sanitizePathParam(req.query.modelId, "modelId")
    const portfolioId = asScalar(req.query.portfolioId)
    const valueCurrency = asScalar(req.query.valueCurrency) || "USD"
    return getRebalanceUrl(
      `/models/${modelId}/plans/weights-from-holdings?portfolioId=${encodeURIComponent(portfolioId)}&valueCurrency=${encodeURIComponent(valueCurrency)}`,
    )
  },
  methods: ["GET"],
})
