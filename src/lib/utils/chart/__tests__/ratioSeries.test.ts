import { buildRatioSeries, ratioTickPrecision } from "../ratioSeries"

describe("ratioTickPrecision", () => {
  it("uses whole numbers when the ratio moves enough to separate them", () => {
    expect(ratioTickPrecision([100, 104, 92])).toBe(0)
  })

  it("adds a decimal for a narrow span so ticks stop repeating", () => {
    // VOO vs SPY spans about a point — 0dp would print "100 100 99 99 98".
    expect(ratioTickPrecision([100, 100.2, 99.1])).toBe(1)
  })

  it("adds two decimals when the ratio barely moves at all", () => {
    expect(ratioTickPrecision([100, 100.08, 99.94])).toBe(2)
  })

  it("falls back to whole numbers when nothing is plotted", () => {
    expect(ratioTickPrecision([undefined, undefined])).toBe(0)
  })
})

describe("buildRatioSeries", () => {
  const dates = ["2026-01-02", "2026-01-03", "2026-01-06"]

  it("rebases the ratio to 100 at the first point both legs cover", () => {
    const numerator = [
      { priceDate: "2026-01-02", close: 180 },
      { priceDate: "2026-01-03", close: 183.6 },
      { priceDate: "2026-01-06", close: 176.4 },
    ]
    const denominator = [
      { priceDate: "2026-01-02", close: 600 },
      { priceDate: "2026-01-03", close: 600 },
      { priceDate: "2026-01-06", close: 630 },
    ]

    // Raw ratios: 0.30, 0.306, 0.28 → rebased 100, 102, 93.33.
    expect(buildRatioSeries(dates, numerator, denominator)).toEqual([
      100,
      102,
      expect.closeTo(93.33, 2),
    ])
  })

  it("carries the last known close forward when a leg skips a chart date", () => {
    const numerator = [
      { priceDate: "2026-01-02", close: 100 },
      // No 2026-01-03 row — the leg did not trade that day.
      { priceDate: "2026-01-06", close: 110 },
    ]
    const denominator = [
      { priceDate: "2026-01-02", close: 200 },
      { priceDate: "2026-01-03", close: 200 },
      { priceDate: "2026-01-06", close: 200 },
    ]

    // 2026-01-03 reuses the 2026-01-02 numerator, so the ratio is flat at 100.
    expect(buildRatioSeries(dates, numerator, denominator)).toEqual([
      100,
      100,
      expect.closeTo(110, 6),
    ])
  })

  it("leaves points undefined until both legs have a close, then rebases there", () => {
    const numerator = [
      { priceDate: "2026-01-03", close: 50 },
      { priceDate: "2026-01-06", close: 60 },
    ]
    const denominator = [
      { priceDate: "2026-01-02", close: 100 },
      { priceDate: "2026-01-03", close: 100 },
      { priceDate: "2026-01-06", close: 100 },
    ]

    // Numerator starts a day late; the rebase anchors on 2026-01-03, not the
    // first chart date, so the overlay always begins at 100.
    expect(buildRatioSeries(dates, numerator, denominator)).toEqual([
      undefined,
      100,
      120,
    ])
  })

  it("skips points where the denominator is zero rather than dividing by it", () => {
    const numerator = [
      { priceDate: "2026-01-02", close: 10 },
      { priceDate: "2026-01-03", close: 10 },
      { priceDate: "2026-01-06", close: 12 },
    ]
    const denominator = [
      { priceDate: "2026-01-02", close: 5 },
      { priceDate: "2026-01-03", close: 0 },
      { priceDate: "2026-01-06", close: 5 },
    ]

    expect(buildRatioSeries(dates, numerator, denominator)).toEqual([
      100,
      undefined,
      120,
    ])
  })

  it("stops the overlay once a leg's last close goes stale", () => {
    // svc-data can hold a fuller history for one leg than the other. Carrying
    // a month-old denominator forward would draw a ratio that is really just
    // the numerator's own move, so the overlay ends where its data ends.
    const chartDates = ["2026-01-02", "2026-01-09", "2026-01-30"]
    const numerator = [
      { priceDate: "2026-01-02", close: 100 },
      { priceDate: "2026-01-09", close: 110 },
      { priceDate: "2026-01-30", close: 130 },
    ]
    const denominator = [
      { priceDate: "2026-01-02", close: 100 },
      { priceDate: "2026-01-09", close: 100 },
      // Nothing after 2026-01-09 — 2026-01-30 is 21 days stale.
    ]

    expect(buildRatioSeries(chartDates, numerator, denominator)).toEqual([
      100,
      expect.closeTo(110, 6),
      undefined,
    ])
  })

  it("does not anchor the rebase on a zero ratio", () => {
    // A zero numerator close would otherwise become the rebase base, and
    // every later point divides by it — one bad quote blanking the range.
    const numerator = [
      { priceDate: "2026-01-02", close: 0 },
      { priceDate: "2026-01-03", close: 50 },
      { priceDate: "2026-01-06", close: 60 },
    ]
    const denominator = [
      { priceDate: "2026-01-02", close: 100 },
      { priceDate: "2026-01-03", close: 100 },
      { priceDate: "2026-01-06", close: 100 },
    ]

    expect(buildRatioSeries(dates, numerator, denominator)).toEqual([
      undefined,
      100,
      expect.closeTo(120, 6),
    ])
  })

  it("returns undefined for every date when a leg has no prices", () => {
    const denominator = [{ priceDate: "2026-01-02", close: 100 }]

    expect(buildRatioSeries(dates, [], denominator)).toEqual([
      undefined,
      undefined,
      undefined,
    ])
    expect(buildRatioSeries(dates, denominator, [])).toEqual([
      undefined,
      undefined,
      undefined,
    ])
    expect(buildRatioSeries([], denominator, denominator)).toEqual([])
  })

  it("ignores leg prices dated after the chart date being plotted", () => {
    const numerator = [
      { priceDate: "2026-01-02", close: 100 },
      { priceDate: "2026-01-04", close: 500 },
      { priceDate: "2026-01-06", close: 120 },
    ]
    const denominator = [
      { priceDate: "2026-01-02", close: 100 },
      { priceDate: "2026-01-03", close: 100 },
      { priceDate: "2026-01-06", close: 100 },
    ]

    // The 2026-01-04 spike sits between chart dates; 2026-01-03 must not
    // borrow it, and 2026-01-06 uses its own row.
    expect(buildRatioSeries(dates, numerator, denominator)).toEqual([
      100, 100, 120,
    ])
  })
})
