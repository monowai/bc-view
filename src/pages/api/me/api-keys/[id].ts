import {
  createApiHandler,
  sanitizePathParam,
} from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const id = sanitizePathParam(req.query.id, "id")
    return getDataUrl(`/me/api-keys/${id}`)
  },
  methods: ["DELETE"],
})
