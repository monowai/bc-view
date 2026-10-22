import {
  createApiHandler,
  sanitizePathParam,
} from "@utils/api/createApiHandler"
import { getAgentUrl } from "@utils/api/bcConfig"

/**
 * PUT    → set a user's weekly AI allowance (`{weeklyLimit}` or `{unlimited: true}`)
 * DELETE → return the user to the default allowance
 *
 * `id` is the SystemUser id; it is validated and encoded before it reaches the
 * upstream path.
 */
export default createApiHandler({
  url: (req) =>
    getAgentUrl(
      `/agent/quota/${encodeURIComponent(sanitizePathParam(req.query.id, "user id"))}`,
    ),
  methods: ["PUT", "DELETE"],
})
