import {
  createApiHandler,
  sanitizePathParam,
} from "@utils/api/createApiHandler"
import { getEventUrl } from "@utils/api/bcConfig"

/**
 * Reprocess an event. With `portfolioId`, svc-event creates the transaction in
 * that portfolio only; `payDate` overrides the computed pay date.
 */
export default createApiHandler({
  url: (req) => {
    const eventId = sanitizePathParam(req.query.eventId, "eventId")
    const query = new URLSearchParams()
    const { portfolioId, payDate } = req.query
    if (typeof portfolioId === "string" && portfolioId) {
      query.set("portfolioId", sanitizePathParam(portfolioId, "portfolioId"))
    }
    if (typeof payDate === "string" && payDate) query.set("payDate", payDate)
    const search = query.toString()
    return getEventUrl(`/${eventId}${search ? `?${search}` : ""}`)
  },
  methods: ["POST"],
})
