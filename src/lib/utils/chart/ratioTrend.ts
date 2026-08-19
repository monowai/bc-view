/**
 * Which way the plotted ratio is trending, as a state per day.
 *
 * A ratio line shows the level; it does not say when the trend turned. This
 * module reduces the *same series the chart is already plotting* to one of
 * three states, so a ribbon under the plot can carry the turn. It knows nothing
 * about which ratio that is — what "rising" means in words is the caller's to
 * name, because it differs per overlay: for `vs SPY` a rise is the asset
 * outperforming, for RSP/SPY it is market breadth widening.
 *
 * Deliberately never Buy/Sell. The chart already renders ▲ Buy / ▼ Sell markers
 * for actual trades; a state that borrowed those words (or red/green) would
 * make a derived opinion look like a recorded fact.
 */

export type RatioTrend = "rising" | "falling" | "flat"

/**
 * Smoothing applied to the ratio before its slope is read, in days.
 *
 * The raw day-over-day slope is unusable: over six months of MSFT against SPY it
 * repainted 27 times (median run 3 days), and no window between 5 and 30 with
 * any band between 0 and 0.30 was calm. 15 with the hysteresis below settled at
 * 8 flips, median run 15 days.
 */
export const TREND_EMA_WINDOW = 15

/**
 * Slope, in percent per day, the smoothed ratio must clear before the state
 * changes. It is a *hysteresis* band, not a dead zone: see below.
 */
export const TREND_BAND_PCT = 0.3

function ema(
  values: (number | undefined)[],
  window: number,
): (number | undefined)[] {
  const k = 2 / (window + 1)
  let prev: number | undefined
  return values.map((v) => {
    // NaN and Infinity are `typeof "number"`. A malformed close would otherwise
    // poison the running average for the rest of the series.
    if (typeof v !== "number" || !Number.isFinite(v)) {
      // Restart the average across a hole rather than carrying the pre-gap
      // level over it. Blending the first value on the far side into an
      // average from before reads as one enormous day of movement.
      prev = undefined
      return undefined
    }
    prev = prev === undefined ? v : v * k + prev * (1 - k)
    return prev
  })
}

/**
 * State per day for a relative-strength series (asset / benchmark, rebased —
 * see `buildRatioSeries`).
 *
 * The band is a Schmitt trigger, not a threshold. The state flips to `leading`
 * only when the smoothed slope clears `+band`, and back to `lagging` only when
 * it drops under `−band`; in between it *holds whatever it was*. A plain
 * threshold instead reverts to neutral on every day the slope grazes zero,
 * which is most days — that is what turned the ribbon into a barcode.
 *
 * Days the ratio cannot cover (a leg with no close, so `buildRatioSeries` left
 * `undefined`) report `inline`: no data, no claim. A gap also *clears* the held
 * state — resuming "leading" on the far side of a blackout would date the claim
 * to before it, and the smoothing restarts for the same reason.
 */
export function ratioTrendStates(
  ratio: (number | undefined)[],
  { window = TREND_EMA_WINDOW, band = TREND_BAND_PCT } = {},
): RatioTrend[] {
  const smoothed = ema(ratio, window)
  let held: RatioTrend = "flat"
  return smoothed.map((value, i) => {
    const prev = i > 0 ? smoothed[i - 1] : undefined
    if (
      typeof value !== "number" ||
      typeof prev !== "number" ||
      !Number.isFinite(value) ||
      !Number.isFinite(prev)
    ) {
      held = "flat"
      return held
    }
    const slope = ((value - prev) / prev) * 100
    if (slope > band) held = "rising"
    else if (slope < -band) held = "falling"
    return held
  })
}

export interface TrendSummary {
  /** State on the last day of the range. */
  current: RatioTrend
  /** Date the current run started; undefined for an empty range. */
  since?: string
  /** Length of the current run, in charted days. */
  runDays: number
  /** Share of the range spent rising / falling, 0-100. */
  risingPct: number
  fallingPct: number
}

/**
 * Range-level read of a state series, for the legend line: what it is doing now,
 * since when, and how the whole range split. `dates` is the chart's own date
 * spine and must align index-for-index with `states`.
 */
export function summariseTrend(
  states: RatioTrend[],
  dates: string[],
): TrendSummary {
  if (states.length === 0) {
    return { current: "flat", runDays: 0, risingPct: 0, fallingPct: 0 }
  }
  const current = states[states.length - 1]
  let start = states.length - 1
  while (start > 0 && states[start - 1] === current) start--
  const share = (state: RatioTrend): number =>
    Math.round((states.filter((s) => s === state).length / states.length) * 100)
  return {
    current,
    since: dates[start],
    runDays: states.length - start,
    risingPct: share("rising"),
    fallingPct: share("falling"),
  }
}

/**
 * Share of a pane reserved below the data for the ribbon lane.
 */
export const TREND_LANE_FRACTION = 0.12

/**
 * Extend a y-axis domain downward to make room for the ribbon.
 *
 * Every axis the chart draws on needs this, not just the price axis: the ratio
 * overlay has its own scale, and without the same reservation its line dips
 * into the lane and crosses the ribbon.
 */
export function reserveRibbonLane(
  [low, high]: [number, number],
  fraction: number = TREND_LANE_FRACTION,
): [number, number] {
  // A flat series has no span to take a share of; fall back to the level itself
  // so the lane still has height.
  const span = high - low || Math.abs(high) || 1
  return [low - span * fraction, high]
}

/**
 * Ribbon colours: direction only. Blue/red rather than green/red — green is the
 * price fill, and red/green here would read as good/bad, which a falling ratio
 * is not (RSP/SPY falling is narrowing breadth, not a loss). The words beside
 * the swatch carry the meaning.
 */
export const TREND_COLOR: Record<RatioTrend, string> = {
  rising: "#2563EB",
  falling: "#DC2626",
  flat: "#9CA3AF",
}
