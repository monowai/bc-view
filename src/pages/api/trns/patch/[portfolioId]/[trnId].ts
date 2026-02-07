import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const { portfolioId, trnId } = req.query
    return getDataUrl(`/trns/${portfolioId}/${trnId}`)
  },
  methods: ["PATCH"],
})
