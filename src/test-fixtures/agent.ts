import { AgentQuotaOverview, AgentQuotaStatus } from "types/agent"

export function makeAgentQuota(
  overrides: Partial<AgentQuotaStatus> = {},
): AgentQuotaStatus {
  return {
    limit: 10,
    used: 3,
    remaining: 7,
    resetAt: "2026-10-29T01:02:03Z",
    contact: "help@example.com",
    override: false,
    unlimited: false,
    verified: true,
    ...overrides,
  }
}

export function makeAgentQuotaOverview(
  overrides: Partial<AgentQuotaOverview> = {},
): AgentQuotaOverview {
  return {
    defaultLimit: 10,
    users: {},
    ...overrides,
  }
}
