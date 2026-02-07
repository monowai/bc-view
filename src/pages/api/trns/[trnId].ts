import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const { trnId, portfolioId } = req.query
    if (req.method === "PATCH") {
      return getDataUrl(`/trns/${portfolioId}/${trnId}`)
    }
    return getDataUrl(`/trns/${trnId}`)
  },
  methods: ["GET", "PATCH", "DELETE"],
})
