import {
  TREND_BAND_PCT,
  TREND_EMA_WINDOW,
  ratioTrendStates,
  reserveRibbonLane,
  summariseTrend,
} from "../ratioTrend"

/** A ratio that gains a fixed percentage every day. */
function climbing(days: number, perDay = 0.01): number[] {
  return Array.from({ length: days }, (_, i) => 100 * (1 + perDay) ** i)
}
function falling(days: number, perDay = 0.01): number[] {
  return climbing(days, -perDay)
}
function dates(n: number): string[] {
  // Consecutive days from 2026-01-01; only ordering and identity matter here.
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(2026, 0, 1 + i))
    return d.toISOString().slice(0, 10)
  })
}

describe("ratioTrendStates", () => {
  it("calls a sustained gain against SPY leading", () => {
    const states = ratioTrendStates(climbing(40))

    expect(states[states.length - 1]).toBe("rising")
  })

  it("calls a sustained loss against SPY lagging", () => {
    const states = ratioTrendStates(falling(40))

    expect(states[states.length - 1]).toBe("falling")
  })

  it("holds the previous state while the slope drifts inside the band", () => {
    // The hysteresis that makes the ribbon readable. A plain threshold repaints
    // every time the slope grazes zero — 27 flips over a six-month range in the
    // playground against 8 with the hold.
    const rs = [
      ...climbing(30),
      ...Array.from({ length: 15 }, () => 100 * 1.01 ** 29),
    ]

    const states = ratioTrendStates(rs)

    expect(states[29]).toBe("rising")
    expect(states[states.length - 1]).toBe("rising")
  })

  it("flips only once the opposite band is crossed", () => {
    const rs = [
      ...climbing(30),
      ...falling(30).map((v) => (v * (100 * 1.01 ** 29)) / 100),
    ]

    const states = ratioTrendStates(rs)

    expect(states[29]).toBe("rising")
    expect(states[states.length - 1]).toBe("falling")
  })

  it("does not flip on a single day of counter-move inside the band", () => {
    const rise = climbing(30)
    const last = rise[rise.length - 1]
    const states = ratioTrendStates([...rise, last * 0.9995])

    expect(states[states.length - 1]).toBe("rising")
  })

  it("reads flat until the band is first cleared", () => {
    const flat = Array.from({ length: 20 }, () => 100)

    const states = ratioTrendStates(flat)

    // The first day has no previous value to measure a slope against, so it
    // has no state at all rather than a flat one.
    expect(states[0]).toBeUndefined()
    expect(states.slice(1).every((s) => s === "flat")).toBe(true)
  })

  it("restarts neutral after a mid-series gap instead of resuming the old claim", () => {
    // A hole longer than the ratio's carry-forward (a leg whose history ends,
    // a feed outage) means we no longer know how the asset stands. Resuming
    // "rising" on the far side would date a claim to before the blackout.
    const rise = climbing(30)
    const last = rise[rise.length - 1]
    const states = ratioTrendStates([
      ...rise,
      undefined,
      undefined,
      undefined,
      last,
      last,
    ])

    expect(states[29]).toBe("rising")
    expect(states[30]).toBeUndefined()
    expect(states[states.length - 1]).toBe("flat")
  })

  it("does not manufacture a flip from the level either side of a gap", () => {
    // The smoothing must restart too. Comparing the first post-gap value
    // against a pre-gap average reads as one enormous day of movement.
    const before = climbing(20)
    const after = climbing(6).map((v) => v * 3)

    const states = ratioTrendStates([
      ...before,
      undefined,
      undefined,
      undefined,
      ...after,
    ])

    // First value back has nothing to compare against; the day after it must
    // read flat rather than inheriting a slope from across the blackout.
    expect(states[before.length + 3]).toBeUndefined()
    expect(states[before.length + 4]).toBe("flat")
  })

  it("reports no state at all for a day the ratio does not cover", () => {
    // buildRatioSeries leaves a leg's missing days undefined rather than
    // dividing by a stale close. "flat" would be a claim about those days —
    // a caller counting states would tally them as steady, and a ribbon would
    // paint them. Absence has to stay absent.
    const states = ratioTrendStates([...climbing(20), undefined, undefined])

    expect(states[states.length - 1]).toBeUndefined()
    expect(states).toHaveLength(22)
  })

  it("makes no claim when the previous value is zero", () => {
    // Dividing by a zero previous value yields Infinity, which clears any band
    // and would read as a violent move in whichever direction the sign fell.
    const states = ratioTrendStates([0, 0, 100, 100])

    expect(states[1]).toBe("flat")
    expect(states[2]).toBe("flat")
  })

  it("returns one state per input point", () => {
    expect(ratioTrendStates(climbing(7))).toHaveLength(7)
    expect(ratioTrendStates([])).toHaveLength(0)
  })
})

describe("summariseTrend", () => {
  it("reports the current run and the date it started", () => {
    const rs = [...falling(25), ...climbing(25).map((v) => v * 0.8)]
    const states = ratioTrendStates(rs)
    const d = dates(rs.length)

    const summary = summariseTrend(states, d)

    expect(summary.current).toBe("rising")
    expect(summary.runDays).toBeGreaterThan(1)
    expect(summary.since).toBe(d[d.length - summary.runDays])
  })

  it("splits the range into rising and falling percentages", () => {
    const states = ["rising", "rising", "falling", "flat"] as ReturnType<
      typeof ratioTrendStates
    >

    const summary = summariseTrend(states, dates(4))

    expect(summary.risingPct).toBe(50)
    expect(summary.fallingPct).toBe(25)
  })

  it("survives an empty range without dividing by zero", () => {
    const summary = summariseTrend([], [])

    expect(summary.current).toBe("flat")
    expect(summary.risingPct).toBe(0)
    expect(summary.fallingPct).toBe(0)
    expect(summary.since).toBeUndefined()
  })
})

describe("tuning constants", () => {
  it("keeps the defaults the playground settled on", () => {
    // EMA 15 / ±0.30%/day gave 8 colour flips over six months of MSFT vs SPY
    // (median run 15 days). Shorter windows or a tighter band produced a
    // barcode; see project_rs_ribbon_encoding.
    expect(TREND_EMA_WINDOW).toBe(15)
    expect(TREND_BAND_PCT).toBeCloseTo(0.3)
  })
})

describe("reserveRibbonLane", () => {
  it("extends the domain downward so nothing plots in the lane", () => {
    const [lo, hi] = reserveRibbonLane([100, 200])

    expect(hi).toBe(200)
    expect(lo).toBeLessThan(100)
  })

  it("leaves the top of the range where the caller put it", () => {
    // Only the floor moves: pushing the ceiling would shrink the data's own
    // pane every time the ribbon turned on.
    const [, hi] = reserveRibbonLane([0.5, 0.9])

    expect(hi).toBeCloseTo(0.9)
  })

  it("reserves the same share of the pane whatever the units", () => {
    const [smallLo] = reserveRibbonLane([0, 10])
    const [bigLo] = reserveRibbonLane([0, 1000])

    expect(smallLo / 10).toBeCloseTo(bigLo / 1000)
  })

  it("still reserves a lane for a flat series with no span", () => {
    const [lo, hi] = reserveRibbonLane([100, 100])

    expect(lo).toBeLessThan(hi)
  })
})

describe("summariseTrend with coverage holes", () => {
  it("does not weld a run across a gap", () => {
    const states = ["rising", "rising", undefined, "rising"] as ReturnType<
      typeof ratioTrendStates
    >

    const summary = summariseTrend(states, dates(4))

    expect(summary.current).toBe("rising")
    expect(summary.runDays).toBe(1)
    expect(summary.since).toBe(dates(4)[3])
  })

  it("takes percentages over the days actually covered", () => {
    const states = ["rising", undefined, undefined, "falling"] as ReturnType<
      typeof ratioTrendStates
    >

    const summary = summariseTrend(states, dates(4))

    expect(summary.risingPct).toBe(50)
    expect(summary.fallingPct).toBe(50)
  })

  it("says nothing when no day is covered", () => {
    const summary = summariseTrend([undefined, undefined], dates(2))

    expect(summary.current).toBe("flat")
    expect(summary.runDays).toBe(0)
    expect(summary.risingPct).toBe(0)
  })
})
