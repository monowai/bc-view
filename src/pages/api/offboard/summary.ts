import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

/**
 * API route for offboarding summary.
 * GET: Returns counts of user's data (portfolios, assets, tax rates).
 */
export default createApiHandler({
  url: getDataUrl("/offboard/summary"),
})
