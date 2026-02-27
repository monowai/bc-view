import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

/**
 * API route for user milestones.
 * GET: Returns all earned milestones, explorer actions, and notification mode.
 */
export default createApiHandler({
  url: getDataUrl("/api/milestones"),
  methods: ["GET"],
})
