import { createApiHandler } from "@utils/api/createApiHandler"
import { getRebalanceUrl } from "@utils/api/bcConfig"

/**
 * API route for deleting user's rebalance models.
 * DELETE: Deletes all user's model portfolios and plans.
 */
export default createApiHandler({
  url: getRebalanceUrl("/models"),
  methods: ["DELETE"],
})
