import {
  createApiHandler,
  sanitizePathParam,
} from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const itemId = sanitizePathParam(req.query.itemId, "itemId")
    return getDataUrl(`/watchlist/items/${itemId}`)
  },
  methods: ["PATCH", "DELETE"],
})
