import { createApiHandler } from "@utils/api/createApiHandler"
import { getEventUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const today = new Date()
    const fiveDaysAgo = new Date(today)
    fiveDaysAgo.setDate(today.getDate() - 5)
    const fromDate =
      (req.query.fromDate as string) ||
      fiveDaysAgo.toISOString().split("T")[0]
    const toDate =
      (req.query.toDate as string) || today.toISOString().split("T")[0]
    return getEventUrl(`/backfill?fromDate=${fromDate}&toDate=${toDate}`)
  },
  methods: ["POST"],
})
