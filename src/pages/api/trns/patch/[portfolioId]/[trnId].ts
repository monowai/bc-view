import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"
import { transformTrnEnvelopeJson } from "@utils/trns/trnsSelectors"

export default createApiHandler({
  url: (req) => {
    const { portfolioId, trnId } = req.query
    return getDataUrl(`/trns/${portfolioId}/${trnId}`)
  },
  methods: ["PATCH"],
  transformJson: transformTrnEnvelopeJson,
})
