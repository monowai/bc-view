import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    if (req.method === "POST") {
      return getDataUrl("/portfolios")
    }
    return getDataUrl(`/portfolios/${req.query.id}`)
  },
  methods: ["GET", "PATCH", "POST", "DELETE"],
})
