import { AgentQuotaStatus } from "types/agent"

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
