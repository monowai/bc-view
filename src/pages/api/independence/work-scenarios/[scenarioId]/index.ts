import { createApiHandler } from "@utils/api/createApiHandler"
import { getRetireUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => getRetireUrl(`/scenarios/${req.query.scenarioId}`),
  methods: ["GET", "PATCH", "DELETE"],
})
