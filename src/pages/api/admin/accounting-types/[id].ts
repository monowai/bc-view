import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => getDataUrl(`/admin/accounting-types/${req.query.id}`),
  methods: ["PATCH", "DELETE"],
})
