import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

/**
 * Proxy for PATCH /trns/{trnId}/status (Unsettle action).
 * Returns TrnStatusUpdateResponse — the updated TrnDto plus the ids of auto-settled
 * cash legs reverted to PROPOSED by the server (not deleted); see `siblings`.
 */
export default createApiHandler({
  url: (req) => {
    const { trnId } = req.query
    return getDataUrl(`/trns/${trnId}/status`)
  },
  methods: ["PATCH"],
})
