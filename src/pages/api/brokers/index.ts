import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const qs = req.url?.split("?")[1] || ""
    const base = getDataUrl("/brokers")
    return qs ? `${base}?${qs}` : base
  },
  methods: ["GET", "POST"],
})
