/**
 * The FI progress bar can be shown as two stacked segments:
 *   1. the portfolio's own progress (liquid assets / FI Number), and
 *   2. the extra progress bought by guaranteed income (Social Security / CPF
 *      LIFE), credited as the present value of that future stream.
 *
 * Both share the same denominator (the portfolio-only FI Number), so the
 * segments are additive: liquid% + income% = "FI including guaranteed income".
 * The backend supplies `fiProgress` (segment 1) and `retirementAgeFiProgress`
 * (the combined total); the income segment is the difference.
 *
 * Overflow is shown honestly — `totalProgress` is left unclamped so the caller
 * can render e.g. "106%" while the bar itself fills to the 100% edge.
 */
export interface FiStack {
  /** Blue segment width (%), clamped to [0, 100]. */
  liquidPct: number
  /** Guaranteed-income segment width (%), stacked after liquid, clamped so the pair never exceeds 100. */
  incomePct: number
  /** Combined progress including guaranteed income — UNCLAMPED, for the label. */
  totalProgress: number
  /** Whether a distinct guaranteed-income segment should render. */
  hasIncome: boolean
  /** Combined progress reaches financial independence (>= 100%). */
  achieved: boolean
}

export function deriveFiStack(opts: {
  fiProgress: number
  retirementAgeFiProgress?: number | null
}): FiStack {
  const { fiProgress, retirementAgeFiProgress } = opts
  const liquidPct = clamp(fiProgress, 0, 100)

  const hasIncome =
    retirementAgeFiProgress != null && retirementAgeFiProgress > fiProgress

  if (!hasIncome) {
    return {
      liquidPct,
      incomePct: 0,
      totalProgress: fiProgress,
      hasIncome: false,
      achieved: fiProgress >= 100,
    }
  }

  const totalClamped = clamp(retirementAgeFiProgress, 0, 100)
  return {
    liquidPct,
    incomePct: Math.max(0, totalClamped - liquidPct),
    totalProgress: retirementAgeFiProgress,
    hasIncome: true,
    achieved: retirementAgeFiProgress >= 100,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
