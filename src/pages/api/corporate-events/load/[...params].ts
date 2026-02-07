import { createApiHandler } from "@utils/api/createApiHandler"
import { getEventUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const params = req.query.params as string[]
    const portfolioId = params[0]
    const asAt = req.query.asAt as string
    return getEventUrl(`/load/${portfolioId}?asAt=${asAt}`)
  },
  methods: ["POST"],
})
