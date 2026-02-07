import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const { portfolioId, cashAssetId } = req.query
    return getDataUrl(`/trns/${portfolioId}/cash-ladder/${cashAssetId}`)
  },
})
