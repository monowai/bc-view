import {
  createApiHandler,
  sanitizePathParam,
} from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const alertId = sanitizePathParam(req.query.alertId, "alertId")
    return getDataUrl(`/watchlist/alerts/${alertId}`)
  },
  methods: ["DELETE"],
})
