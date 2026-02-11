import {
  createApiHandler,
  sanitizePathParam,
} from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const price = req.query.price as string[]
    const sanitized = price.map((p) => sanitizePathParam(p, "price"))
    return getDataUrl(`/prices/${sanitized.join("/")}`)
  },
})
