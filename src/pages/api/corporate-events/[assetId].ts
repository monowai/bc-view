import { createApiHandler } from "@utils/api/createApiHandler"
import { getEventUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const { assetId, fromDate, toDate } = req.query
    if (fromDate && toDate) {
      return getEventUrl(
        `/events/${assetId}?fromDate=${fromDate}&toDate=${toDate}`,
      )
    }
    return getEventUrl(`/events/${assetId}`)
  },
})
