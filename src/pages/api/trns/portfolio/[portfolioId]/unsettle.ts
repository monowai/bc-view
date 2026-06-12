import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => getDataUrl(`/trns/portfolio/${req.query.portfolioId}/unsettle`),
  methods: ["POST"],
})
