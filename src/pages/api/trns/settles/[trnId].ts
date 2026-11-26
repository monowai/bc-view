import {
  createApiHandler,
  sanitizePathParam,
} from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"
import { transformTrnEnvelopeJson } from "@utils/trns/trnsSelectors"

/**
 * Proxy for GET /trns/{trnId}/settles: the trade an auto-settle cash leg
 * settles, so the leg is edited through that trade. 404 when it is not a leg.
 */
export default createApiHandler({
  url: (req) => {
    const trnId = sanitizePathParam(req.query.trnId, "trnId")
    return getDataUrl(`/trns/${trnId}/settles`)
  },
  methods: ["GET"],
  transformJson: transformTrnEnvelopeJson,
})
