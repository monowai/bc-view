import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const countryCode = (req.query.countryCode as string).toUpperCase()
    return getDataUrl(`/tax-rates/${countryCode}`)
  },
  methods: ["GET", "DELETE"],
})
