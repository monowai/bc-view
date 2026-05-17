import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"
import { transformTrnEnvelopeJson } from "@utils/trns/trnsSelectors"

export default createApiHandler({
  url: (req) => {
    const tradeDate = req.query.tradeDate as string
    return getDataUrl(`/trns/settled?tradeDate=${tradeDate}`)
  },
  transformJson: transformTrnEnvelopeJson,
})
