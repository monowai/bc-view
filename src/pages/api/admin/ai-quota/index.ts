import { createApiHandler } from "@utils/api/createApiHandler"
import { getAgentUrl } from "@utils/api/bcConfig"

/** Every user's weekly AI allowance (`{data: AgentQuotaOverview}`, admin only). */
export default createApiHandler({ url: getAgentUrl("/agent/quota/overview") })
