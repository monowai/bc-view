import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"
import { transformTrnEnvelopeJson } from "@utils/trns/trnsSelectors"

export default createApiHandler({
  url: (req) => {
    const { portfolioId, cashAssetId } = req.query
    return getDataUrl(`/trns/${portfolioId}/cash-ladder/${cashAssetId}`)
  },
  transformJson: transformTrnEnvelopeJson,
})
