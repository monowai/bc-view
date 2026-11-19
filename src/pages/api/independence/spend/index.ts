import { createApiHandler } from "@utils/api/createApiHandler"
import { getRetireUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const params = new URLSearchParams()
    if (typeof req.query.from === "string") params.set("from", req.query.from)
    if (typeof req.query.to === "string") params.set("to", req.query.to)
    const query = params.toString()
    return query ? `${getRetireUrl("/spend")}?${query}` : getRetireUrl("/spend")
  },
  methods: ["GET"],
})
