import { createApiHandler } from "@utils/api/createApiHandler"
import { getEventUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const today = new Date()
    const thirtyDaysAgo = new Date(today)
    thirtyDaysAgo.setDate(today.getDate() - 30)
    const fromDate =
      (req.query.fromDate as string) ||
      thirtyDaysAgo.toISOString().split("T")[0]
    return getEventUrl(`/load?fromDate=${fromDate}`)
  },
  methods: ["POST"],
})
