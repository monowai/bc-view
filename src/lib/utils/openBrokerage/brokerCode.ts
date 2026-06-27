/**
 * Derive a short, stable CODE from a broker's display name. Used for the
 * brokerage portfolio code (new-portfolio path) and the per-broker cash
 * asset code (existing-portfolio path, e.g. `IB-SGD`) so the codes stay
 * compact instead of echoing the full name ("INTERACTIVE BROKERS-SGD").
 *
 * Rules:
 *   1. A curated map wins for well-known brokers whose initials would be
 *      ambiguous or whose house abbreviation differs (e.g. JP Morgan → JPM).
 *   2. Multi-word names collapse to their word initials (Interactive
 *      Brokers → IB, Charles Schwab → CS).
 *   3. Single-word names keep their full alphanumeric uppercase form
 *      (Fidelity → FIDELITY, DBS → DBS).
 */

// Lower-cased name → house abbreviation. Keep this small: only entries the
// initials/single-word fallback would get wrong belong here.
const KNOWN_BROKER_CODES: Record<string, string> = {
  "jp morgan": "JPM",
  "j.p. morgan": "JPM",
  "td ameritrade": "TDA",
  "bank of america": "BOA",
}

const alnum = (s: string): string => s.replace(/[^A-Za-z0-9]/g, "")

/**
 * The per-broker cash asset code: `{brokerCode}-{currency}` (e.g. `IB-USD`).
 * Single source of truth so the onboarding/wizard preview and the asset the
 * orchestrator actually creates can never drift apart.
 */
export function brokerCashAssetCode(
  brokerCode: string,
  currency: string,
): string {
  return `${brokerCode}-${currency}`
}

export function deriveBrokerCode(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return ""

  const known = KNOWN_BROKER_CODES[trimmed.toLowerCase()]
  if (known) return known

  const words = trimmed.split(/\s+/).filter(Boolean)
  if (words.length > 1) {
    // Word initials. Strip any stray punctuation a word might start with
    // (e.g. "&" in "Smith & Co") so the code stays clean.
    const initials = words.map((w) => alnum(w).charAt(0)).join("")
    if (initials) return initials.toUpperCase()
  }

  return alnum(trimmed).toUpperCase()
}
