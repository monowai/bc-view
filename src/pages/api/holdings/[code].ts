import { createApiHandler } from "@utils/api/createApiHandler"
import { getPositionsUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const { code, asAt } = req.query
    return getPositionsUrl(`/${code}?asAt=${asAt}`)
  },
})
