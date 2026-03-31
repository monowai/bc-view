import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const inactive = req.query.inactive === "true" ? "?inactive=true" : ""
    return getDataUrl(`/portfolios${inactive}`)
  },
  methods: ["GET", "POST"],
})
