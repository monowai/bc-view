import type { PathToHorizon } from "types/independence"

/**
 * Pure formatters for the off-track "Path to Horizon" block returned by
 * svc-retire. The backend owns all solver logic — these helpers only turn the
 * already-computed levers into plain-language copy for non-financial users.
 *
 * Amounts are in the plan currency (caller passes the symbol/code). Return
 * rates are DECIMALS (0.0432 = 4.32%). A null lever means the solver could not
 * reach `targetAge` within its bounds (unsolvable).
 */

export type HorizonTone = "warning" | "neutral"

export interface HorizonHeader {
  /** Plain-language headline describing what carries the plan to targetAge. */
  text: string
  /** Visual tone — never "success"; an off-track plan must not read as green. */
  tone: HorizonTone
}

const fmtMoney = (value: number, currency: string): string =>
  `${currency}${Math.round(value).toLocaleString()}`

const fmtRate = (rate: number): string => `${(rate * 100).toFixed(1)}%`

/**
 * Build the off-track headline. Surfaces whichever levers the backend solved:
 * both, one, or — when neither is reachable — a no-numbers fallback that nudges
 * the user toward lower expenses or a later start.
 */
export function formatHorizonHeader(
  horizon: PathToHorizon,
  currency: string,
): HorizonHeader {
  const {
    targetAge,
    currentMonthlyContribution,
    requiredMonthlyContribution,
    currentReturnRate,
    requiredReturnRate,
  } = horizon

  const today = `Currently saving ${fmtMoney(
    currentMonthlyContribution,
    currency,
  )}/mo at ${fmtRate(currentReturnRate)}/yr.`

  const haveContribution = requiredMonthlyContribution != null
  const haveReturn = requiredReturnRate != null

  if (haveContribution && haveReturn) {
    return {
      tone: "warning",
      text: `To last to age ${targetAge}: save ~${fmtMoney(
        requiredMonthlyContribution,
        currency,
      )}/mo, or grow at ~${fmtRate(requiredReturnRate)}/yr. ${today}`,
    }
  }

  if (haveContribution) {
    return {
      tone: "warning",
      text: `To last to age ${targetAge}: save ~${fmtMoney(
        requiredMonthlyContribution,
        currency,
      )}/mo. ${today}`,
    }
  }

  if (haveReturn) {
    return {
      tone: "warning",
      text: `To last to age ${targetAge}: grow at ~${fmtRate(
        requiredReturnRate,
      )}/yr. ${today}`,
    }
  }

  return {
    tone: "warning",
    text:
      `Even large changes won't reach age ${targetAge} at this spending — ` +
      `consider lower expenses or a later start.`,
  }
}

/**
 * Body-only contribution-gap detail: the extra monthly saving (at today's
 * return) needed to reach `targetAge`. Returns null when the contribution lever
 * is unsolvable or when there is no positive gap (already saving enough).
 */
export function formatHorizonGap(
  horizon: PathToHorizon,
  currency: string,
): string | null {
  const { targetAge, currentMonthlyContribution, requiredMonthlyContribution } =
    horizon
  if (requiredMonthlyContribution == null) return null
  const gap = requiredMonthlyContribution - currentMonthlyContribution
  if (gap <= 0) return null
  return `Add ~${fmtMoney(
    gap,
    currency,
  )}/mo at today's return to reach age ${targetAge}.`
}
