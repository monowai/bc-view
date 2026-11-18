import {
  createApiHandler,
  sanitizePathParam,
} from "@utils/api/createApiHandler"
import { getEventUrl } from "@utils/api/bcConfig"

/**
 * `/load/{portfolioId}` loads while the caller waits;
 * `/load/{portfolioId}/background` starts the load and answers 202 at once.
 */
export default createApiHandler({
  url: (req) => {
    const params = req.query.params as string[]
    const portfolioId = sanitizePathParam(params[0], "portfolioId")
    const asAt = sanitizePathParam(req.query.asAt, "asAt")
    const background = params[1] === "background" ? "/background" : ""
    return getEventUrl(`/load/${portfolioId}${background}?asAt=${asAt}`)
  },
  methods: ["POST"],
})
