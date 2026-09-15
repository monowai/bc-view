import {
  createApiHandler,
  sanitizePathParam,
} from "@utils/api/createApiHandler"
import { getRetireUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const id = sanitizePathParam(req.query.id, "id")
    return getRetireUrl(`/independence-plans/${id}/duplicate`)
  },
  methods: ["POST"],
})
