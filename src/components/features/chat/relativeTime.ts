const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * Compact "how long ago" for the conversation list: `just now`, `5m ago`,
 * `3h ago`, `2d ago`, then a short date beyond a week.
 */
export function formatRelativeTime(
  iso: string,
  now: Date = new Date(),
): string {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return ""
  const elapsed = now.getTime() - then.getTime()
  if (elapsed < MINUTE) return "just now"
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m ago`
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h ago`
  if (elapsed < 7 * DAY) return `${Math.floor(elapsed / DAY)}d ago`
  return then.toLocaleDateString(undefined, { day: "numeric", month: "short" })
}
