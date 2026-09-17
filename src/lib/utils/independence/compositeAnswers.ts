import type { CompositeProjectionResult } from "types/independence"

/**
 * The handful of numbers the composite plan page leads with.
 *
 * Extracted because the verdict block and the wealth chart both need them and
 * they must agree: a headline saying "FI at age 61" above a chart whose
 * crossing marker sits at 63 reads as a broken tool, and that is exactly what
 * two private copies of this arithmetic would eventually produce.
 *
 * Every figure here is either echoed straight from the projection or derived
 * from its own rows — nothing is re-modelled in the browser.
 */
export interface CompositeAnswers {
  /** Backend-authoritative FI number (25× duration-weighted net spend). */
  fiNumber: number
  /** Liquid (spendable) assets today, per the projection echo. */
  currentLiquid: number
  /** Distance to the FI number. Positive = still to go, negative = surplus. */
  gap: number
  /** True once liquid assets have reached the FI number. */
  isAchieved: boolean
  /** First projected age whose ending balance reaches the FI number. */
  fiCrossingAge: number | null
  /** Years from today to {@link fiCrossingAge}. */
  yearsToFi: number | null
  /**
   * True when the trajectory crosses back under the FI line after clearing it.
   * Worth saying out loud — "FI at 61" alone would be a half-truth.
   */
  dipsBelow: boolean
}

/**
 * Derive the page's headline numbers from a composite projection.
 *
 * Scans `yearlyProjections` only, deliberately: those are the drawdown years
 * the FI number is defined against. `accumulationProjections` (pre-retirement)
 * are charted, but treating them as FI crossings would answer a different
 * question from the one the FI number asks.
 */
export function compositeAnswers(
  projection: CompositeProjectionResult | undefined,
  currentAge: number | undefined,
): CompositeAnswers | null {
  if (!projection) return null

  const fiNumber = projection.fiNumber ?? 0
  const currentLiquid = projection.liquidAssets ?? 0
  const rows = projection.yearlyProjections ?? []

  const fiCrossingAge =
    fiNumber > 0
      ? (rows.find((r) => r.endingBalance >= fiNumber)?.age ?? null)
      : null

  const firstAbove =
    fiNumber > 0 ? rows.findIndex((r) => r.endingBalance >= fiNumber) : -1
  const dipsBelow =
    firstAbove !== -1 &&
    rows.slice(firstAbove + 1).some((r) => r.endingBalance < fiNumber)

  return {
    fiNumber,
    currentLiquid,
    gap: fiNumber - currentLiquid,
    isAchieved: fiNumber > 0 && currentLiquid >= fiNumber,
    fiCrossingAge,
    yearsToFi:
      fiCrossingAge != null && currentAge != null
        ? fiCrossingAge - currentAge
        : null,
    dipsBelow,
  }
}
