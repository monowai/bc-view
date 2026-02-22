import {
  createApiHandler,
  sanitizePathParam,
} from "@utils/api/createApiHandler"
import { getPositionsUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const code = sanitizePathParam(req.query.code, "code")
    return getPositionsUrl(`/${code}/performance/cache`)
  },
  methods: ["DELETE"],
})
