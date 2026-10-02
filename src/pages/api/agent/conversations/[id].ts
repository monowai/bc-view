import {
  createApiHandler,
  sanitizePathParam,
} from "@utils/api/createApiHandler"
import { getAgentUrl } from "@utils/api/bcConfig"

/**
 * One svc-agent conversation.
 * GET: the conversation with its turns. PATCH: rename (`{title}`).
 * DELETE: remove it (204).
 */
export default createApiHandler({
  url: (req) => {
    const id = sanitizePathParam(req.query.id, "id")
    return getAgentUrl(`/agent/conversations/${encodeURIComponent(id)}`)
  },
  methods: ["GET", "PATCH", "DELETE"],
})
