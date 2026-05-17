import {
  createApiHandler,
  sanitizePathParam,
} from "@utils/api/createApiHandler"
import { getPositionsUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const id = sanitizePathParam(req.query.id, "id")
    const asAt = req.query.asAt as string | undefined
    const params = new URLSearchParams()
    if (asAt) params.set("asAt", asAt)
    const qs = params.toString()
    return getPositionsUrl(`/id/${id}${qs ? `?${qs}` : ""}`)
  },
})
