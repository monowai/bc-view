/**
 * Shared X-axis configuration for independence projection charts.
 *
 * Product rule: the age axis must ALWAYS span the user's current age through
 * their life expectancy — even when the projection data stops earlier (e.g. the
 * portfolio depletes) or runs past it. Pinning the domain keeps every chart on
 * the same horizon so the "runway vs. shortfall" story reads consistently.
 */

/**
 * Domain `[minAge, maxAge]` for the age axis. Prefers the explicit
 * currentAge / lifeExpectancy; falls back to the data range when either is
 * missing, and guards against an inverted/degenerate range.
 */
export function ageAxisDomain(
  currentAge: number | undefined,
  lifeExpectancy: number | undefined,
  ages: number[] = [],
): [number, number] {
  const valid = ages.filter((a) => Number.isFinite(a))
  const dataMin = valid.length ? Math.min(...valid) : (currentAge ?? 0)
  const dataMax = valid.length
    ? Math.max(...valid)
    : (lifeExpectancy ?? dataMin)
  const min = currentAge ?? dataMin
  const max = lifeExpectancy ?? dataMax
  if (min < max) return [min, max]
  // Degenerate (missing/equal/inverted) — widen to cover whatever we have.
  return [Math.min(min, dataMin), Math.max(max, dataMax, min + 1)]
}

/**
 * Readable tick array across `[min, max]`. 5-year steps for ≤30y spans,
 * 10-year otherwise; always pins the endpoints and folds in any `extras`
 * (e.g. retirement / FI ages) that fall strictly inside the range.
 */
export function ageAxisTicks(
  min: number,
  max: number,
  extras: number[] = [],
): number[] {
  if (!(max > min)) return [min]
  const step = max - min <= 30 ? 5 : 10
  const ticks: number[] = [min]
  for (let a = Math.ceil(min / step) * step; a <= max; a += step) {
    if (a > min && a < max) ticks.push(a)
  }
  ticks.push(max)
  for (const e of extras) {
    if (Number.isFinite(e) && e > min && e < max) ticks.push(e)
  }
  return [...new Set(ticks)].sort((a, b) => a - b)
}
