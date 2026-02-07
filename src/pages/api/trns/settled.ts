import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const tradeDate = req.query.tradeDate as string
    return getDataUrl(`/trns/settled?tradeDate=${tradeDate}`)
  },
})
