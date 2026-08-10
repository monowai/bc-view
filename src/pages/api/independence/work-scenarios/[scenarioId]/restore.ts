import { createApiHandler } from "@utils/api/createApiHandler"
import { getRetireUrl } from "@utils/api/bcConfig"

// Undo a logical delete (svc-retire #229). The scenario comes back with its
// expenses and contributions, but NOT current.
export default createApiHandler({
  url: (req) => getRetireUrl(`/scenarios/${req.query.scenarioId}/restore`),
  methods: ["POST"],
})
