import { createApiHandler } from "@utils/api/createApiHandler"
import { getRetireUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => getRetireUrl(`/admin/quick-scenarios/${req.query.id}`),
  methods: ["PATCH", "DELETE"],
})
