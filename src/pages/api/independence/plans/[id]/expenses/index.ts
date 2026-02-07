import { createApiHandler } from "@utils/api/createApiHandler"
import { getRetireUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const baseUrl = getRetireUrl(`/plans/${req.query.id}/expenses`)
    return req.query.phase ? `${baseUrl}?phase=${req.query.phase}` : baseUrl
  },
  methods: ["GET", "POST"],
})
