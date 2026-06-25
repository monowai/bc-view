import { Portfolio, UserPreferences } from "types/beancounter"

/**
 * Zen mode — the single source of truth for "this user only manages one
 * portfolio, so hide multi-portfolio chrome" across bc-view.
 *
 * When zen mode is on, screens drop portfolio pickers, skip the aggregate
 * drill-down (clicking the wealth figure goes straight to the sole portfolio),
 * and auto-target that portfolio for new entries.
 *
 * Today it is DERIVED from the portfolio count. It will eventually become an
 * explicit `SystemUser` property surfaced on `UserPreferences.zenMode`; when
 * that lands, the explicit flag wins and the count derivation becomes the
 * fallback for users who never set it. Both behaviours already flow through
 * {@link deriveZenMode} so the swap is a one-line change here, not a sweep of
 * every call site.
 */

/** A user at or below this many portfolios is in zen mode by derivation. */
export const ZEN_PORTFOLIO_THRESHOLD = 1

/**
 * Resolve zen mode for a user.
 *
 * @param portfolioCount how many portfolios contribute to the user's view
 * @param explicit the user's explicit preference, once set (future SystemUser
 *   property). `undefined`/`null` means "not set" → fall back to derivation.
 */
export function deriveZenMode(
  portfolioCount: number,
  explicit?: boolean | null,
): boolean {
  if (explicit !== undefined && explicit !== null) return explicit
  return portfolioCount <= ZEN_PORTFOLIO_THRESHOLD
}

/** Convenience overload reading the explicit flag straight off preferences. */
export function deriveZenModeFromPreferences(
  portfolioCount: number,
  preferences: UserPreferences | null,
): boolean {
  return deriveZenMode(portfolioCount, preferences?.zenMode)
}

/**
 * The user's sole *active* portfolio, or null when there is anything other
 * than exactly one to target. Archived portfolios (`active === false`) are
 * ignored so a lone live portfolio still auto-targets even when an old one
 * lingers. Centralized here because several screens need "the one portfolio"
 * and must agree on what counts (see PayslipModal, OpenBrokerageWizard,
 * proposed transactions).
 */
export function solePortfolio(portfolios: Portfolio[]): Portfolio | null {
  const active = portfolios.filter((p) => p.active !== false)
  return active.length === 1 ? active[0] : null
}

/** Convenience: the sole active portfolio's id, or "" when there isn't one. */
export function solePortfolioId(portfolios: Portfolio[]): string {
  return solePortfolio(portfolios)?.id ?? ""
}

/**
 * Whether a portfolio picker should be shown. The picker is only hidden when
 * zen mode is on AND there is exactly one portfolio to auto-target — so a
 * zero-portfolio user, an in-flight (still-empty) portfolio fetch, or an
 * explicit-zen user who nonetheless has several portfolios always keeps the
 * picker rather than being stranded with no way to choose.
 */
export function showPortfolioPicker(
  portfolios: Portfolio[],
  preferences: UserPreferences | null,
): boolean {
  const zen = deriveZenModeFromPreferences(portfolios.length, preferences)
  return !zen || !solePortfolio(portfolios)
}
