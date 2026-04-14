import { createApiHandler } from "@utils/api/createApiHandler"
import { getAgentUrl } from "@utils/api/bcConfig"

export default createApiHandler({ url: getAgentUrl("/agent/health") })
