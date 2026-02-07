import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

/**
 * API route for deleting user's custom assets.
 * DELETE: Deletes all user-owned assets and their associated data.
 */
export default createApiHandler({
  url: getDataUrl("/offboard/assets"),
  methods: ["DELETE"],
})
