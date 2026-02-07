import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

/**
 * API route for deleting user's wealth data (portfolios, assets, transactions).
 * DELETE: Deletes all user's portfolios and custom assets.
 */
export default createApiHandler({
  url: getDataUrl("/offboard/wealth"),
  methods: ["DELETE"],
})
