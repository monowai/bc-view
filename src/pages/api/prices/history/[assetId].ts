import {
  createApiHandler,
  sanitizePathParam,
} from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const assetId = sanitizePathParam(req.query.assetId, "assetId")
    const from = req.query.from as string | undefined
    const to = req.query.to as string | undefined
    const params = new URLSearchParams()
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    const qs = params.toString()
    return getDataUrl(`/prices/${assetId}/history${qs ? `?${qs}` : ""}`)
  },
})
