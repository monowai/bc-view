import {
  RS_BAND_PCT,
  RS_EMA_WINDOW,
  relativeStrengthStates,
  summariseRelativeStrength,
} from "../relativeStrength"

/** Rising RS: the asset gains on SPY every day. */
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

describe("relativeStrengthStates", () => {
  it("calls a sustained gain against SPY leading", () => {
    const states = relativeStrengthStates(climbing(40))

    expect(states[states.length - 1]).toBe("leading")
  })

  it("calls a sustained loss against SPY lagging", () => {
    const states = relativeStrengthStates(falling(40))

    expect(states[states.length - 1]).toBe("lagging")
  })

  it("holds the previous state while the slope drifts inside the band", () => {
    // The hysteresis that makes the ribbon readable. A plain threshold repaints
    // every time the slope grazes zero — 27 flips over a six-month range in the
    // playground against 8 with the hold.
    const rs = [
      ...climbing(30),
      ...Array.from({ length: 15 }, () => 100 * 1.01 ** 29),
    ]

    const states = relativeStrengthStates(rs)

    expect(states[29]).toBe("leading")
    expect(states[states.length - 1]).toBe("leading")
  })

  it("flips only once the opposite band is crossed", () => {
    const rs = [
      ...climbing(30),
      ...falling(30).map((v) => (v * (100 * 1.01 ** 29)) / 100),
    ]

    const states = relativeStrengthStates(rs)

    expect(states[29]).toBe("leading")
    expect(states[states.length - 1]).toBe("lagging")
  })

  it("does not flip on a single day of counter-move inside the band", () => {
    const rise = climbing(30)
    const last = rise[rise.length - 1]
    const states = relativeStrengthStates([...rise, last * 0.9995])

    expect(states[states.length - 1]).toBe("leading")
  })

  it("reads in line until the band is first cleared", () => {
    const flat = Array.from({ length: 20 }, () => 100)

    const states = relativeStrengthStates(flat)

    expect(states.every((s) => s === "inline")).toBe(true)
  })

  it("carries no state across a gap in the underlying ratio", () => {
    // buildRatioSeries leaves a leg's missing days undefined rather than
    // dividing by a stale close; those days cannot claim a relative strength.
    const states = relativeStrengthStates([
      ...climbing(20),
      undefined,
      undefined,
    ])

    expect(states[states.length - 1]).toBe("inline")
    expect(states).toHaveLength(22)
  })

  it("returns one state per input point", () => {
    expect(relativeStrengthStates(climbing(7))).toHaveLength(7)
    expect(relativeStrengthStates([])).toHaveLength(0)
  })
})

describe("summariseRelativeStrength", () => {
  it("reports the current run and the date it started", () => {
    const rs = [...falling(25), ...climbing(25).map((v) => v * 0.8)]
    const states = relativeStrengthStates(rs)
    const d = dates(rs.length)

    const summary = summariseRelativeStrength(states, d)

    expect(summary.current).toBe("leading")
    expect(summary.runDays).toBeGreaterThan(1)
    expect(summary.since).toBe(d[d.length - summary.runDays])
  })

  it("splits the range into leading and lagging percentages", () => {
    const states = ["leading", "leading", "lagging", "inline"] as ReturnType<
      typeof relativeStrengthStates
    >

    const summary = summariseRelativeStrength(states, dates(4))

    expect(summary.leadingPct).toBe(50)
    expect(summary.laggingPct).toBe(25)
  })

  it("survives an empty range without dividing by zero", () => {
    const summary = summariseRelativeStrength([], [])

    expect(summary.current).toBe("inline")
    expect(summary.leadingPct).toBe(0)
    expect(summary.laggingPct).toBe(0)
    expect(summary.since).toBeUndefined()
  })
})

describe("tuning constants", () => {
  it("keeps the defaults the playground settled on", () => {
    // EMA 15 / ±0.30%/day gave 8 colour flips over six months of MSFT vs SPY
    // (median run 15 days). Shorter windows or a tighter band produced a
    // barcode; see project_rs_ribbon_encoding.
    expect(RS_EMA_WINDOW).toBe(15)
    expect(RS_BAND_PCT).toBeCloseTo(0.3)
  })
})
