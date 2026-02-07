import { createApiHandler } from "@utils/api/createApiHandler"
import { getRebalanceUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => getRebalanceUrl(`/executions/${req.query.id}/commit`),
  methods: ["POST"],
})
