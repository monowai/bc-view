/**
 * Relative-strength overlays for the price chart.
 *
 * A ratio overlay divides one price series by another — RSP/SPY (equal-weight
 * vs cap-weight S&P 500, a market-breadth read) being the canonical example.
 * The raw quotient is meaningless on a price axis (RSP/SPY sits near 0.28), so
 * the series is rebased to 1.0 at the first date both legs cover. Every point
 * then reads as "where the ratio stands against where it started this range" —
 * the same index the chart puts price on when an overlay is showing, which is
 * what lets one axis carry both.
 */

export interface RatioLegPoint {
  priceDate: string
  close: number
}

const REBASE_AT = 1

// How long a leg's last close may stand in for a missing one *inside* its own
// series — enough to cover a holiday one feed skipped and the other did not.
const MAX_CARRY_FORWARD_DAYS = 7
const MS_PER_DAY = 86_400_000

/**
 * Close of `leg` as at `date` — the most recent row on or before it. Legs are
 * assumed sorted ascending (svc-data returns price history that way); `cursor`
 * is the caller's position in `leg` and is advanced in place so the whole walk
 * stays linear.
 *
 * Two ways this returns nothing. Past the last row of the series there is no
 * close at any age: svc-data holds deeper history for some assets than others,
 * and dividing by a leg that has simply ended plots the *other* leg's move as
 * if it were a ratio. Inside the series a hole is just a day the feed skipped,
 * so the previous close stands in — but only for MAX_CARRY_FORWARD_DAYS, past
 * which it has stopped describing the leg.
 */
function closeAsAt(
  leg: RatioLegPoint[],
  date: string,
  cursor: { i: number },
): number | undefined {
  if (leg.length === 0 || date > leg[leg.length - 1].priceDate) return undefined
  while (cursor.i < leg.length && leg[cursor.i].priceDate <= date) {
    cursor.i++
  }
  if (cursor.i === 0) return undefined
  const latest = leg[cursor.i - 1]
  const ageDays = (Date.parse(date) - Date.parse(latest.priceDate)) / MS_PER_DAY
  // An unparseable date gives NaN, and `NaN > MAX_CARRY_FORWARD_DAYS` is false —
  // which would hand back a close of unknown age as if it were current.
  if (!Number.isFinite(ageDays)) return undefined
  return ageDays > MAX_CARRY_FORWARD_DAYS ? undefined : latest.close
}

/**
 * Build a rebased numerator/denominator overlay aligned to `dates` — the
 * primary chart's own price dates.
 *
 * Points stay `undefined` until both legs have a close (so a leg that starts
 * late leaves a gap rather than a spike) and where the denominator is zero.
 * A leg missing one of the chart's dates carries its last known close forward,
 * which matters when the primary asset trades on a market whose calendar
 * differs from the overlay's.
 */
export function buildRatioSeries(
  dates: string[],
  numerator: RatioLegPoint[],
  denominator: RatioLegPoint[],
): (number | undefined)[] {
  const numCursor = { i: 0 }
  const denCursor = { i: 0 }
  let base: number | undefined

  return dates.map((date) => {
    const num = closeAsAt(numerator, date, numCursor)
    const den = closeAsAt(denominator, date, denCursor)
    // Not just undefined: a malformed close arrives as NaN or Infinity, and
    // either one captured as the rebase base turns the whole series into NaN —
    // which the axis helpers then reduce to a NaN domain and no chart at all.
    if (
      num === undefined ||
      den === undefined ||
      !Number.isFinite(num) ||
      !Number.isFinite(den) ||
      den === 0
    ) {
      return undefined
    }

    const ratio = num / den
    // Two finite closes can still divide to an overflow.
    if (!Number.isFinite(ratio)) return undefined
    // A zero ratio cannot be rebased onto, and anchoring on one would divide
    // every later point by zero — skip it rather than blank the whole range.
    if (ratio === 0) return undefined
    if (base === undefined) base = ratio
    return (ratio / base) * REBASE_AT
  })
}

// Narrowest band the indexed axis will show, as a fraction of the base. A
// ratio against a benchmark the asset largely *is* — VOO against SPY — moves a
// fraction of a percent, and on a short range its price barely moves either;
// scaling the axis to the data drew that noise as a crash. 5% is wide enough
// that a flat pair reads flat and a real divergence still stands out.
const MIN_AXIS_SPAN = 0.05
const AXIS_PADDING = 0.08

/**
 * Bounds of every finite value across the given series, or undefined if none
 * is plottable.
 *
 * A loop rather than `Math.min(...values)`: one axis can carry price, its SMA,
 * two marker series and the ratio, and spreading that many points into a call
 * risks the engine's argument limit on the longer ranges.
 *
 * Not `typeof v === "number"` either — NaN and Infinity pass that, and either
 * one reaching the bounds gives a NaN domain and no axis at all.
 */
function extent(
  series: (number | undefined)[][],
): { min: number; max: number } | undefined {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  let seen = false
  for (const values of series) {
    for (const v of values) {
      if (typeof v !== "number" || !Number.isFinite(v)) continue
      if (v < min) min = v
      if (v > max) max = v
      seen = true
    }
  }
  return seen ? { min, max } : undefined
}

/**
 * Y-axis bounds for a set of series that all share one indexed scale — price
 * indexed to its own first close, plus whatever ratio is overlaid.
 *
 * The domain spans every series given, widened to at least MIN_AXIS_SPAN
 * around its midpoint, then padded so no line grazes the frame. One axis is
 * the point: separate scales let the eye read crossings between price and
 * ratio that exist only because the two scales were chosen that way.
 */
export function indexedAxisDomain(
  series: (number | undefined)[][],
): [number, number] {
  const plotted = extent(series)
  if (plotted === undefined) {
    return [REBASE_AT - MIN_AXIS_SPAN / 2, REBASE_AT + MIN_AXIS_SPAN / 2]
  }
  const { min, max } = plotted
  const mid = (min + max) / 2
  const half = Math.max((max - min) / 2, MIN_AXIS_SPAN / 2)
  const padded = half * (1 + AXIS_PADDING)
  return [mid - padded, mid + padded]
}
