import { createApiHandler } from "@utils/api/createApiHandler"
import { getEventUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const { eventId, payDate } = req.query
    let url = getEventUrl(`/${eventId}`)
    if (payDate && typeof payDate === "string") {
      url += `?payDate=${payDate}`
    }
    return url
  },
  methods: ["POST"],
})
