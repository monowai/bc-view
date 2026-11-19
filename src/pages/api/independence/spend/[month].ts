import { createApiHandler } from "@utils/api/createApiHandler"
import { getRetireUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => getRetireUrl(`/spend/${req.query.month}`),
  methods: ["PUT"],
})
