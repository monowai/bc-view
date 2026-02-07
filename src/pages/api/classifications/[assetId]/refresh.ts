import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => getDataUrl(`/classifications/refresh/${req.query.assetId}`),
  methods: ["POST"],
})
