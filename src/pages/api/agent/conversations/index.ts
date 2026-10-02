import { createApiHandler } from "@utils/api/createApiHandler"
import { getAgentUrl } from "@utils/api/bcConfig"

const DIGITS = /^\d+$/

/**
 * svc-agent chat history for the caller.
 * GET: newest-active conversations (`?page=&size=` forwarded when numeric).
 * POST: start an empty conversation.
 * DELETE: remove all of the caller's conversations.
 */
export default createApiHandler({
  url: (req) => {
    const params = new URLSearchParams()
    for (const key of ["page", "size"]) {
      const value = req.query[key]
      if (typeof value === "string" && DIGITS.test(value)) {
        params.set(key, value)
      }
    }
    const qs = params.toString()
    return getAgentUrl(`/agent/conversations${qs ? `?${qs}` : ""}`)
  },
  methods: ["GET", "POST", "DELETE"],
})
