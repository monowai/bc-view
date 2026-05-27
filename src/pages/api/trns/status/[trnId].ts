import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

/**
 * Proxy for PATCH /trns/{trnId}/status (Unsettle action).
 * Returns TrnStatusUpdateResponse — the updated TrnDto plus the auto-emitted
 * sibling ids the UI should prompt the user to delete.
 */
export default createApiHandler({
  url: (req) => {
    const { trnId } = req.query
    return getDataUrl(`/trns/${trnId}/status`)
  },
  methods: ["PATCH"],
})
