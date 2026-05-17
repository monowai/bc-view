import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"
import { transformTrnEnvelopeJson } from "@utils/trns/trnsSelectors"

export default createApiHandler({
  url: (req) => {
    const yearMonth = req.query.yearMonth as string | undefined
    const params = new URLSearchParams()
    if (yearMonth) params.append("yearMonth", yearMonth)
    const qs = params.toString()
    return getDataUrl(
      `/trns/investments/monthly/transactions${qs ? `?${qs}` : ""}`,
    )
  },
  transformJson: transformTrnEnvelopeJson,
})
