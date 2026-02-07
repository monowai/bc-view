import { createApiHandler } from "@utils/api/createApiHandler"
import { getPositionsUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const { brokerId } = req.query
    const asAt = (req.query.asAt as string) || "today"
    const value = req.query.value !== "false"
    return getPositionsUrl(`/broker/${brokerId}?asAt=${asAt}&value=${value}`)
  },
})
