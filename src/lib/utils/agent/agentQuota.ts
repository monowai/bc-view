import { AgentQuotaStatus } from "types/agent"

/**
 * "7 of 10 AI questions left this week" for a metered user; null for an
 * unlimited one. Both numbers come from svc-agent as-is — `remaining` is
 * clamped server-side, so it is never recomputed here.
 */
export function quotaRemainingText(quota: AgentQuotaStatus): string | null {
  if (quota.unlimited) return null
  return `${quota.remaining} of ${quota.limit} AI questions left this week`
}

/**
 * When the oldest counted question frees up, in the reader's locale and zone.
 * `locale` / `timeZone` default to the browser's; tests pin them.
 */
export function quotaResetText(
  resetAt: string | null,
  locale?: string,
  timeZone?: string,
): string | null {
  if (!resetAt) return null
  const at = new Date(resetAt)
  if (Number.isNaN(at.getTime())) return null
  const when = at.toLocaleString(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  })
  return `The next one frees up on ${when}.`
}
