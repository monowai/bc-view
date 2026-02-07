import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) =>
    getDataUrl(
      `/brokers/${req.query.id}/transfer?toBrokerId=${req.query.toBrokerId}`,
    ),
  methods: ["POST"],
})
