/**
 * Relative strength of the charted asset against the market, as a state per day.
 *
 * The ratio overlays answer "what is the market doing" (RSP/SPY = breadth) or
 * "how does this asset compare" (vs SPY). Neither says *when* the comparison
 * turned. This module reduces the asset-vs-SPY series to one of three states so
 * the chart can carry that in a channel of its own — a ribbon under the plot —
 * rather than overloading a line's colour with a variable the line does not plot.
 *
 * Deliberately not called Buy/Sell. The chart already renders ▲ Buy / ▼ Sell
 * markers for actual trades; a state that borrowed those words (or red/green)
 * would make a derived opinion look like a recorded fact.
 */

export type RsState = "leading" | "lagging" | "inline"

/**
 * Smoothing applied to the ratio before its slope is read, in days.
 *
 * The raw day-over-day slope is unusable: over six months of MSFT vs SPY it
 * repainted 27 times (median run 3 days), and no window between 5 and 30 with
 * any band between 0 and 0.30 was calm. 15 with the hysteresis below settled at
 * 8 flips, median run 15 days.
 */
export const RS_EMA_WINDOW = 15

/**
 * Slope, in percent per day, the smoothed ratio must clear before the state
 * changes. It is a *hysteresis* band, not a dead zone: see below.
 */
export const RS_BAND_PCT = 0.3

function ema(
  values: (number | undefined)[],
  window: number,
): (number | undefined)[] {
  const k = 2 / (window + 1)
  let prev: number | undefined
  return values.map((v) => {
    if (typeof v !== "number") return undefined
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
 * `undefined`) report `inline`: no data, no claim.
 */
export function relativeStrengthStates(
  ratio: (number | undefined)[],
  { window = RS_EMA_WINDOW, band = RS_BAND_PCT } = {},
): RsState[] {
  const smoothed = ema(ratio, window)
  let held: RsState = "inline"
  return smoothed.map((value, i) => {
    const prev = i > 0 ? smoothed[i - 1] : undefined
    if (typeof value !== "number" || typeof prev !== "number") return "inline"
    const slope = ((value - prev) / prev) * 100
    if (slope > band) held = "leading"
    else if (slope < -band) held = "lagging"
    return held
  })
}

export interface RsSummary {
  /** State on the last day of the range. */
  current: RsState
  /** Date the current run started; undefined for an empty range. */
  since?: string
  /** Length of the current run, in charted days. */
  runDays: number
  /** Share of the range spent leading / lagging, 0-100. */
  leadingPct: number
  laggingPct: number
}

/**
 * Range-level read of a state series, for the legend line: what it is doing now,
 * since when, and how the whole range split. `dates` is the chart's own date
 * spine and must align index-for-index with `states`.
 */
export function summariseRelativeStrength(
  states: RsState[],
  dates: string[],
): RsSummary {
  if (states.length === 0) {
    return { current: "inline", runDays: 0, leadingPct: 0, laggingPct: 0 }
  }
  const current = states[states.length - 1]
  let start = states.length - 1
  while (start > 0 && states[start - 1] === current) start--
  const share = (state: RsState): number =>
    Math.round((states.filter((s) => s === state).length / states.length) * 100)
  return {
    current,
    since: dates[start],
    runDays: states.length - start,
    leadingPct: share("leading"),
    laggingPct: share("lagging"),
  }
}

/**
 * Share of a pane reserved below the data for the ribbon lane.
 */
export const RS_LANE_FRACTION = 0.12

/**
 * Extend a y-axis domain downward to make room for the ribbon.
 *
 * Every axis the chart draws on needs this, not just the price axis: the ratio
 * overlay has its own scale, and without the same reservation its line dips
 * into the lane and crosses the ribbon.
 */
export function reserveRibbonLane(
  [low, high]: [number, number],
  fraction: number = RS_LANE_FRACTION,
): [number, number] {
  // A flat series has no span to take a share of; fall back to the level itself
  // so the lane still has height.
  const span = high - low || Math.abs(high) || 1
  return [low - span * fraction, high]
}

/** Ribbon colours. Blue/red rather than green/red — green is the price fill. */
export const RS_COLOR: Record<RsState, string> = {
  leading: "#2563EB",
  lagging: "#DC2626",
  inline: "#9CA3AF",
}

export const RS_LABEL: Record<RsState, string> = {
  leading: "Outperforming",
  lagging: "Lagging",
  inline: "In line",
}
