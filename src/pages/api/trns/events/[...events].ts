import {
  createApiHandler,
  sanitizePathParam,
} from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const events = req.query.events as string[]
    const portfolioId = sanitizePathParam(events[0], "portfolioId")
    const assetId = sanitizePathParam(events[1], "assetId")
    return getDataUrl(`/trns/${portfolioId}/asset/${assetId}/events`)
  },
})
