/**
 * Where a new portfolio sends the user once it is saved, when another page
 * sent them to make it. Only the screenshot import does so today.
 *
 * The target rides in the URL, so it is attacker-controllable in principle:
 * it is resolved the way the browser would resolve it and accepted only when
 * it lands on an allowed page of this site.
 */
/** The screenshot import page. */
export const SCREENSHOT_IMPORT_PATH = "/brokers/import"

const ALLOWED = [SCREENSHOT_IMPORT_PATH]
const RESOLUTION_ORIGIN = "https://bc.invalid"

/** `returnTo` with `?portfolio=<id>` added, or null when it is not an allowed page. */
export function portfolioReturnTarget(
  raw: string | string[] | undefined,
  portfolioId: string,
): string | null {
  const candidate = Array.isArray(raw) ? raw[0] : raw
  if (!candidate) return null
  let resolved: URL
  try {
    resolved = new URL(candidate, RESOLUTION_ORIGIN)
  } catch {
    return null
  }
  if (resolved.origin !== RESOLUTION_ORIGIN) return null
  if (!ALLOWED.includes(resolved.pathname)) return null
  resolved.searchParams.set("portfolio", portfolioId)
  return `${resolved.pathname}${resolved.search}`
}

/** The link to the new-portfolio page that comes back to `returnTo`. */
export function newPortfolioHref(returnTo: string): string {
  return `/portfolios/__NEW__?${new URLSearchParams({ returnTo }).toString()}`
}
