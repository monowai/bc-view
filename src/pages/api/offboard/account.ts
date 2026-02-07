import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

/**
 * API route for deleting user's entire account.
 * DELETE: Deletes all user data including the SystemUser record.
 */
export default createApiHandler({
  url: getDataUrl("/offboard/account"),
  methods: ["DELETE"],
})
