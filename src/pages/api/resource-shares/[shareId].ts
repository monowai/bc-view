import {
  createApiHandler,
  sanitizePathParam,
} from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const shareId = sanitizePathParam(req.query.shareId, "shareId")
    return getDataUrl(`/resource-shares/${shareId}`)
  },
  methods: ["DELETE"],
})
