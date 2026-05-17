import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"
import { transformTrnEnvelopeJson } from "@utils/trns/trnsSelectors"

export const baseUrl = getDataUrl("/trns/move")

export default createApiHandler({
  url: baseUrl,
  methods: ["POST"],
  transformJson: transformTrnEnvelopeJson,
})
