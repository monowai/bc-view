import { createApiHandler } from "@utils/api/createApiHandler"
import { getEventUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const { assetId, asAt } = req.query
    const dateParam = asAt ? `?asAt=${asAt}` : ""
    return getEventUrl(`/load/asset/${assetId}${dateParam}`)
  },
  methods: ["POST"],
})
