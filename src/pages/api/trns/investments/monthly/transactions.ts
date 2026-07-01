import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"
import { transformTrnEnvelopeJson } from "@utils/trns/trnsSelectors"

export default createApiHandler({
  url: (req) => {
    const days = req.query.days as string | undefined
    const params = new URLSearchParams()
    if (days) params.append("days", days)
    const qs = params.toString()
    return getDataUrl(
      `/trns/investments/monthly/transactions${qs ? `?${qs}` : ""}`,
    )
  },
  transformJson: transformTrnEnvelopeJson,
})
