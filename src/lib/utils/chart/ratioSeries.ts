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

// How long a leg's last close may stand in for a missing one. Covers weekends
// and public holidays; past that the leg is stale rather than merely quiet —
// svc-data holds deeper history for some assets than others, and dragging a
// month-old close forward would draw the other leg's move as if it were a
// ratio. The overlay ends where its data ends instead.
const MAX_CARRY_FORWARD_DAYS = 7
const MS_PER_DAY = 86_400_000

/**
 * Close of `leg` as at `date` — the most recent row on or before it, provided
 * that row is no more than MAX_CARRY_FORWARD_DAYS old. Legs are assumed sorted
 * ascending (svc-data returns price history that way); `cursor` is the caller's
 * position in `leg` and is advanced in place so the whole walk stays linear.
 */
function closeAsAt(
  leg: RatioLegPoint[],
  date: string,
  cursor: { i: number },
): number | undefined {
  while (cursor.i < leg.length && leg[cursor.i].priceDate <= date) {
    cursor.i++
  }
  if (cursor.i === 0) return undefined
  const latest = leg[cursor.i - 1]
  const ageDays = (Date.parse(date) - Date.parse(latest.priceDate)) / MS_PER_DAY
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
    if (num === undefined || den === undefined || den === 0) return undefined

    const ratio = num / den
    // A zero ratio cannot be rebased onto, and anchoring on one would divide
    // every later point by zero — skip it rather than blank the whole range.
    if (ratio === 0) return undefined
    if (base === undefined) base = ratio
    return (ratio / base) * REBASE_AT
  })
}

/**
 * Decimal places the ratio axis needs so its ticks stay distinct. A relative
 * strength line against its own benchmark barely moves — VOO vs SPY spans
 * about a point — and whole-number ticks then read "100 100 99 99 98".
 */
export function ratioTickPrecision(values: (number | undefined)[]): number {
  const plotted = values.filter((v): v is number => typeof v === "number")
  if (plotted.length === 0) return 0
  const span = Math.max(...plotted) - Math.min(...plotted)
  if (span >= 5) return 0
  return span >= 0.5 ? 1 : 2
}
