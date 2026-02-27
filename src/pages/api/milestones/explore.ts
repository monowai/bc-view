import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

/**
 * API route to record a feature discovery action.
 * POST: { actionId }
 */
export default createApiHandler({
  url: getDataUrl("/api/milestones/explore"),
  methods: ["POST"],
})
