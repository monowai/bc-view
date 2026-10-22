import useSWR, { mutate } from "swr"
import { usePermissions } from "@hooks/usePermissions"
import { AgentQuotaStatus } from "types/agent"

export const AGENT_QUOTA_KEY = "/api/agent/quota"

interface AgentQuotaResult {
  /** undefined until loaded, when the user can't use AI, or on failure. */
  quota: AgentQuotaStatus | undefined
  isLoading: boolean
  refresh: () => Promise<unknown>
}

// The quota is a courtesy display: a failure leaves it blank rather than
// surfacing an error over the feature it describes.
async function fetchQuota(url: string): Promise<AgentQuotaStatus | undefined> {
  const res = await fetch(url)
  if (!res.ok) return undefined
  const json = (await res.json()) as { data?: AgentQuotaStatus }
  return json.data
}

/**
 * The caller's weekly AI allowance from svc-agent. Only asked for when the
 * user can use AI at all; shared through SWR so the chat FAB and an open
 * analysis dialog read one copy.
 */
export function useAgentQuota(): AgentQuotaResult {
  const { canUseAi } = usePermissions()
  const {
    data,
    isLoading,
    mutate: revalidate,
  } = useSWR(canUseAi ? AGENT_QUOTA_KEY : null, fetchQuota, {
    revalidateOnFocus: false,
  })
  return { quota: data, isLoading, refresh: revalidate }
}

/**
 * Re-reads the quota after a turn has been answered (or refused), for every
 * mounted consumer. A no-op when nothing displays it.
 */
export function refreshAgentQuota(): Promise<unknown> {
  return mutate(AGENT_QUOTA_KEY)
}
