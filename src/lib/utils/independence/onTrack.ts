/**
 * "On track" verdict for an independence plan.
 *
 * Distinct from the accumulation progress gauge (today's liquid ÷ FI number):
 * this answers whether the *projected* plan actually covers retirement — i.e.
 * the portfolio does not run dry before life expectancy. `depletionAge` is the
 * first age the ending balance hits zero under net withdrawals (expenses minus
 * guaranteed income), so it already accounts for CPF LIFE / pensions: a plan
 * whose income fully covers expenses never depletes and reads as on track.
 */
export interface OnTrackStatus {
  /** True when funds last to (or beyond) life expectancy. */
  onTrack: boolean
  /** Life expectancy the verdict is measured against. */
  lifeExpectancy: number
  /** Age the portfolio runs dry — only set when off track. */
  depletionAge?: number
  /** Years the money falls short of life expectancy (0 when on track). */
  yearsShort: number
}

export function deriveOnTrackStatus(
  depletionAge: number | null | undefined,
  lifeExpectancy: number | undefined,
): OnTrackStatus | null {
  if (lifeExpectancy == null || lifeExpectancy <= 0) return null
  const depletes = depletionAge != null && depletionAge < lifeExpectancy
  return {
    onTrack: !depletes,
    lifeExpectancy,
    depletionAge: depletes ? depletionAge : undefined,
    yearsShort: depletes ? lifeExpectancy - depletionAge : 0,
  }
}
