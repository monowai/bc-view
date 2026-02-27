import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

/**
 * API route to record a newly earned milestone.
 * POST: { milestoneId, tier }
 */
export default createApiHandler({
  url: getDataUrl("/api/milestones/earn"),
  methods: ["POST"],
})
