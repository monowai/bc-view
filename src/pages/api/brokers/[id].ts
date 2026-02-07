import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => getDataUrl(`/brokers/${req.query.id}`),
  methods: ["GET", "PATCH", "DELETE"],
})
