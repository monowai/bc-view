import {
  createApiHandler,
  sanitizePathParam,
} from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const price = req.query.price as string[]
    const sanitized = price.map((p) => sanitizePathParam(p, "price"))
    const asAt = req.query.asAt as string | undefined
    const qs = asAt ? `?asAt=${encodeURIComponent(asAt)}` : ""
    return getDataUrl(`/prices/${sanitized.join("/")}${qs}`)
  },
})
