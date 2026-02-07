import { createApiHandler } from "@utils/api/createApiHandler"
import { getRetireUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) =>
    getRetireUrl(`/projection/plans/${req.query.planId}/monte-carlo`),
  methods: ["POST"],
})
