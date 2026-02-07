import { createApiHandler } from "@utils/api/createApiHandler"
import { getRebalanceUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => getRebalanceUrl(`/models/${req.query.modelId}/plans`),
  methods: ["GET", "POST"],
})
