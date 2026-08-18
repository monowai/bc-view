import {
  buildRatioSeries,
  ratioAxisDomain,
  ratioValuePrecision,
} from "../ratioSeries"

describe("ratioAxisDomain", () => {
  it("keeps a flat ratio looking flat instead of magnifying its noise", () => {
    // VOO vs SPY both track the S&P 500, so the ratio is a constant plus feed
    // noise. Scaling to dataMin/dataMax stretched a 0.4% wobble over the full
    // pane and drew it as a crash.
    const [min, max] = ratioAxisDomain([99.9, 100.1, 99.95])

    expect(max - min).toBeGreaterThanOrEqual(5)
    expect(min).toBeLessThan(99.9)
    expect(max).toBeGreaterThan(100.1)
  })

  it("does not clip a ratio that genuinely moves", () => {
    const [min, max] = ratioAxisDomain([100, 128, 84])

    expect(min).toBeLessThan(84)
    expect(max).toBeGreaterThan(128)
  })

  it("centres the floor on the data, not on 100", () => {
    // A late-starting leg can rebase well away from 100 and still be flat.
    const [min, max] = ratioAxisDomain([130, 130.2])

    expect(min).toBeLessThan(130)
    expect(max).toBeGreaterThan(130.2)
    expect((min + max) / 2).toBeCloseTo(130.1, 1)
  })

  it("returns a sane band when nothing is plotted", () => {
    const [min, max] = ratioAxisDomain([undefined, undefined])

    expect(min).toBeLessThan(100)
    expect(max).toBeGreaterThan(100)
  })
})

describe("ratioValuePrecision", () => {
  it("uses whole numbers when the ratio moves enough to separate them", () => {
    expect(ratioValuePrecision([100, 104, 92])).toBe(0)
  })

  it("adds a decimal for a narrow span so readouts stop repeating", () => {
    expect(ratioValuePrecision([100, 100.2, 99.1])).toBe(1)
  })

  it("adds two decimals when the ratio barely moves at all", () => {
    expect(ratioValuePrecision([100, 100.08, 99.94])).toBe(2)
  })

  it("falls back to whole numbers when nothing is plotted", () => {
    expect(ratioValuePrecision([undefined, undefined])).toBe(0)
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

  it("ends the overlay on a leg's last real date, not days later", () => {
    // svc-data holds deeper history for some assets than others: locally SPY
    // stopped a month short of VOO. Carrying the last denominator close past
    // the end of its series plots the numerator's own move as if it were a
    // ratio — a fake 1.7% slide in VOO vs SPY. Past the end of a leg there is
    // no ratio, however recent that last close is.
    const chartDates = ["2026-01-02", "2026-01-09", "2026-01-12"]
    const numerator = [
      { priceDate: "2026-01-02", close: 100 },
      { priceDate: "2026-01-09", close: 110 },
      { priceDate: "2026-01-12", close: 130 },
    ]
    const denominator = [
      { priceDate: "2026-01-02", close: 100 },
      { priceDate: "2026-01-09", close: 100 },
      // Series ends here. 2026-01-12 is only 3 days on — inside the window
      // that covers interior holidays — but there is nothing left to divide by.
    ]

    expect(buildRatioSeries(chartDates, numerator, denominator)).toEqual([
      100,
      expect.closeTo(110, 6),
      undefined,
    ])
  })

  it("still fills an interior gap from the last close", () => {
    // The distinction that matters: a hole *inside* a series is a day the feed
    // skipped, and the previous close still describes the leg. Past the end of
    // the series it describes nothing.
    const chartDates = ["2026-01-02", "2026-01-05", "2026-01-09"]
    const numerator = [
      { priceDate: "2026-01-02", close: 100 },
      { priceDate: "2026-01-05", close: 110 },
      { priceDate: "2026-01-09", close: 120 },
    ]
    const denominator = [
      { priceDate: "2026-01-02", close: 100 },
      // No 2026-01-05 row — interior hole, fill from 2026-01-02.
      { priceDate: "2026-01-09", close: 100 },
    ]

    expect(buildRatioSeries(chartDates, numerator, denominator)).toEqual([
      100,
      expect.closeTo(110, 6),
      expect.closeTo(120, 6),
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
