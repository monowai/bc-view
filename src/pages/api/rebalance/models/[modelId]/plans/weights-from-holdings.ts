import {
  asScalar,
  createApiHandler,
  sanitizePathParam,
} from "@utils/api/createApiHandler"
import { getRebalanceUrl } from "@utils/api/bcConfig"

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
