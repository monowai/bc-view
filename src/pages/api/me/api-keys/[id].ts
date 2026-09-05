import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => getDataUrl(`/me/api-keys/${req.query.id}`),
  methods: ["DELETE"],
})
