import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => getDataUrl(`/classifications/sectors/${req.query.sectorCode}`),
  methods: ["DELETE"],
})
