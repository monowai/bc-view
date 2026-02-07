import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => getDataUrl(`/trns/broker/${req.query.brokerId}/holdings`),
})
