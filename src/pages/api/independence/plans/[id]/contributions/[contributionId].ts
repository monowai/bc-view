import { createApiHandler } from "@utils/api/createApiHandler"
import { getRetireUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) =>
    getRetireUrl(
      `/plans/${req.query.id}/contributions/${req.query.contributionId}`,
    ),
  methods: ["DELETE"],
})
