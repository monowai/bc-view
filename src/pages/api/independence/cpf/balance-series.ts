import { createApiHandler } from "@utils/api/createApiHandler"
import { getRetireUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const qs = new URLSearchParams(
      req.query as Record<string, string>,
    ).toString()
    return getRetireUrl(`/cpf/balance-series?${qs}`)
  },
  methods: ["GET"],
})
