/**
 * Relative-strength overlays for the price chart.
 *
 * A ratio overlay divides one price series by another — RSP/SPY (equal-weight
 * vs cap-weight S&P 500, a market-breadth read) being the canonical example.
 * The raw quotient is meaningless on a price axis (RSP/SPY sits near 0.28), so
 * the series is rebased to 100 at the first date both legs cover. Every point
 * then reads as "percent of where the ratio started this range".
 */

export interface RatioLegPoint {
  priceDate: string
  close: number
}

const REBASE_AT = 100

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

// Narrowest band the ratio axis will show, in rebased points. A ratio against
// a benchmark the asset largely *is* — VOO against SPY — moves a fraction of a
// percent, and scaling the axis to the data drew that noise as a crash. Five
// points is wide enough that a flat ratio reads flat and a real divergence
// still stands out.
const MIN_AXIS_SPAN = 5
const AXIS_PADDING = 0.08

function plottedValues(values: (number | undefined)[]): number[] {
  // Not `typeof v === "number"`: NaN and Infinity pass that, and either one
  // reaching Math.min/Math.max gives a NaN domain and no axis at all.
  return values.filter((v): v is number => Number.isFinite(v))
}

/**
 * Y-axis bounds for the ratio line: the data's own range, widened to at least
 * MIN_AXIS_SPAN around its midpoint, then padded so the line does not graze
 * the frame. Centred on the data rather than on 100 — a leg that starts late
 * rebases well away from 100 and is still flat.
 */
export function ratioAxisDomain(
  values: (number | undefined)[],
): [number, number] {
  const plotted = plottedValues(values)
  if (plotted.length === 0) {
    return [REBASE_AT - MIN_AXIS_SPAN / 2, REBASE_AT + MIN_AXIS_SPAN / 2]
  }
  const min = Math.min(...plotted)
  const max = Math.max(...plotted)
  const mid = (min + max) / 2
  const half = Math.max((max - min) / 2, MIN_AXIS_SPAN / 2)
  const padded = half * (1 + AXIS_PADDING)
  return [mid - padded, mid + padded]
}

/**
 * Decimal places a ratio readout needs to change from point to point. The axis
 * has a floored span so whole numbers separate its ticks, but the tooltip
 * reports actual values — at 0dp a flat ratio would read "100" all the way
 * across.
 */
export function ratioValuePrecision(values: (number | undefined)[]): number {
  const plotted = plottedValues(values)
  if (plotted.length === 0) return 0
  const span = Math.max(...plotted) - Math.min(...plotted)
  if (span >= 5) return 0
  return span >= 0.5 ? 1 : 2
}
