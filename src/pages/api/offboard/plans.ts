import { createApiHandler } from "@utils/api/createApiHandler"
import { getRetireUrl } from "@utils/api/bcConfig"

/**
 * API route for deleting user's retirement plans.
 * DELETE: Deletes all user's retirement plans and expenses.
 */
export default createApiHandler({
  url: getRetireUrl("/plans"),
  methods: ["DELETE"],
})
