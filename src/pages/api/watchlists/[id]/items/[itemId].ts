import {
  createApiHandler,
  sanitizePathParam,
} from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const id = sanitizePathParam(req.query.id, "id")
    const itemId = sanitizePathParam(req.query.itemId, "itemId")
    return getDataUrl(`/watchlists/${id}/items/${itemId}`)
  },
  methods: ["PATCH", "DELETE"],
})
