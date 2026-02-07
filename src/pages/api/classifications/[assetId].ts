import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => getDataUrl(`/classifications/${req.query.assetId}`),
  methods: ["GET", "PUT", "DELETE"],
})
