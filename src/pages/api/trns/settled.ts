import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"
import { transformTrnEnvelopeJson } from "@utils/trns/trnsSelectors"

export default createApiHandler({
  url: (req) => {
    const from = req.query.from as string
    const to = req.query.to as string
    return getDataUrl(`/trns/settled?from=${from}&to=${to}`)
  },
  transformJson: transformTrnEnvelopeJson,
})
