import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

/**
 * API route for deleting user's portfolios.
 * DELETE: Deletes all user's portfolios and their transactions.
 */
export default createApiHandler({
  url: getDataUrl("/offboard/portfolios"),
  methods: ["DELETE"],
})
