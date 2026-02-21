import {
  createApiHandler,
  sanitizePathParam,
} from "@utils/api/createApiHandler"
import { getPositionsUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const code = sanitizePathParam(req.query.code, "code")
    const monthsRaw = Array.isArray(req.query.months)
      ? req.query.months[0]
      : req.query.months
    const months = Math.max(
      1,
      Math.min(120, parseInt(monthsRaw || "12", 10) || 12),
    )
    return getPositionsUrl(`/${code}/performance?months=${months}`)
  },
})
