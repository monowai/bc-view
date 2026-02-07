import { createApiHandler } from "@utils/api/createApiHandler"
import { getRetireUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) =>
    getRetireUrl(`/plans/${req.query.id}/expenses/${req.query.expenseId}`),
  methods: ["DELETE"],
})
