import {
  createApiHandler,
  sanitizePathParam,
} from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const code = sanitizePathParam(req.query.code, "code")
    return getDataUrl(`/prices/backfill/${code}`)
  },
  methods: ["POST"],
})
