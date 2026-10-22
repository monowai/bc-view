import { createApiHandler } from "@utils/api/createApiHandler"
import { getAgentUrl } from "@utils/api/bcConfig"

/** The caller's weekly AI allowance (`{data: AgentQuotaStatus}`). */
export default createApiHandler({ url: getAgentUrl("/agent/quota") })
