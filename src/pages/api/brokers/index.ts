import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const base = getDataUrl("/brokers")
    const includeAccounts = req.query.includeAccounts === "true"
    return includeAccounts ? `${base}?includeAccounts=true` : base
  },
  methods: ["GET", "POST"],
})
