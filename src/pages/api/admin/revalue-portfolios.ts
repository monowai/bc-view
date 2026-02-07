import { createApiHandler } from "@utils/api/createApiHandler"
import { getPositionsUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const forceParam = req.query.force === "true" ? "?force=true" : ""
    return getPositionsUrl(`/valuations/revalue${forceParam}`)
  },
  methods: ["POST"],
})
