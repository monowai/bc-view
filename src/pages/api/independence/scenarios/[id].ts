import { createApiHandler } from "@utils/api/createApiHandler"
import { getRetireUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => getRetireUrl(`/quick-scenarios/${req.query.id}`),
  methods: ["GET", "PATCH", "DELETE"],
})
