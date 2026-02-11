import {
  createApiHandler,
  sanitizePathParam,
} from "@utils/api/createApiHandler"
import { getEventUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const params = req.query.params as string[]
    const portfolioId = sanitizePathParam(params[0], "portfolioId")
    const asAt = sanitizePathParam(req.query.asAt, "asAt")
    return getEventUrl(`/load/${portfolioId}?asAt=${asAt}`)
  },
  methods: ["POST"],
})
