import {
  createApiHandler,
  sanitizePathParam,
} from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const resourceType = sanitizePathParam(
      req.query.resourceType,
      "resourceType",
    )
    return getDataUrl(`/resource-shares/managed/${resourceType}`)
  },
  methods: ["GET"],
})
