import { createApiHandler } from "@utils/api/createApiHandler"
import { getRebalanceUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => getRebalanceUrl(`/plans/${req.query.id}/execute`),
  methods: ["POST"],
})
