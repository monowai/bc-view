import {
  createApiHandler,
  sanitizePathParam,
} from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"
import { transformTrnEnvelopeJson } from "@utils/trns/trnsSelectors"

export default createApiHandler({
  url: (req) => {
    const events = req.query.events as string[]
    const portfolioId = sanitizePathParam(events[0], "portfolioId")
    const assetId = sanitizePathParam(events[1], "assetId")
    return getDataUrl(`/trns/${portfolioId}/asset/${assetId}/events`)
  },
  // Backend returns the normalised { data: TrnPayload } envelope; denormalize
  // here so browser consumers (e.g. CorporateActionsPopup) receive the legacy
  // { data: Transaction[] } shape they iterate with .find / .filter.
  // Without this, portfolioTransactions is { trns: [...] } (an object) and
  // getMatchingTransaction throws "t.find is not a function" (BC-VIEW-3Q).
  transformJson: transformTrnEnvelopeJson,
})
