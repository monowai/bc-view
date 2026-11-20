import {
  createApiHandler,
  sanitizePathParam,
} from "@utils/api/createApiHandler"
import { getRetireUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) =>
    getRetireUrl(`/spend/${sanitizePathParam(req.query.month, "month")}`),
  methods: ["PUT"],
})
