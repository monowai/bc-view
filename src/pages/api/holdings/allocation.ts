import { createApiHandler } from "@utils/api/createApiHandler"
import { getPositionsUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const asAt = (req.query.asAt as string) || "today"
    const ids = req.query.ids as string | undefined
    let url = getPositionsUrl(`/allocation?asAt=${asAt}`)
    if (ids) url += `&ids=${encodeURIComponent(ids)}`
    return url
  },
})
