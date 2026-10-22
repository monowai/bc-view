import React from "react"
import { useAgentQuota } from "@hooks/useAgentQuota"
import { describeAgentError } from "@utils/agent/agentErrors"
import { quotaRemainingText, quotaResetText } from "@utils/agent/agentQuota"

/**
 * "7 of 10 AI questions left this week" for a metered user. Renders nothing
 * for an unlimited user or before the quota has loaded.
 */
export function AgentQuotaLine({
  className = "",
}: {
  className?: string
}): React.ReactElement | null {
  const { quota } = useAgentQuota()
  const text = quota ? quotaRemainingText(quota) : null
  if (!text) return null
  return (
    <p
      data-testid="agent-quota"
      className={`text-[11px] text-gray-400 ${className}`}
    >
      {text}
    </p>
  )
}

/**
 * Explains an `ai-quota` refusal: the week's questions are used, when the
 * next frees up, and who to ask for a bigger allowance. The SSE error carries
 * only the code, so the details come from the quota itself.
 */
export function AgentQuotaNotice(): React.ReactElement {
  const { quota } = useAgentQuota()
  const copy = describeAgentError("ai-quota")
  const reset = quota ? quotaResetText(quota.resetAt) : null
  const contact = quota?.contact
  return (
    <div
      role="status"
      className="bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-lg p-3 text-sm"
    >
      <p className="font-semibold mb-1">{copy.title}</p>
      <p>
        {reset ?? copy.message}
        {contact && (
          <>
            {" "}
            To increase your quota, email{" "}
            <a href={`mailto:${contact}`} className="underline font-medium">
              {contact}
            </a>
            .
          </>
        )}
      </p>
    </div>
  )
}
