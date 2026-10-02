import { createApiHandler } from "@utils/api/createApiHandler"
import { getAgentUrl } from "@utils/api/bcConfig"

/**
 * API route for deleting the user's AI chat history.
 * DELETE: Deletes all of the caller's svc-agent conversations.
 */
export default createApiHandler({
  url: getAgentUrl("/agent/conversations"),
  methods: ["DELETE"],
})
