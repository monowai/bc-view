import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const trades = req.query.trades as string[]
    if (req.method === "DELETE") {
      return getDataUrl(`/trns/${trades[0]}`)
    }
    return getDataUrl(`/trns/${trades[0]}/asset/${trades[1]}/trades`)
  },
  methods: ["GET", "DELETE"],
})
