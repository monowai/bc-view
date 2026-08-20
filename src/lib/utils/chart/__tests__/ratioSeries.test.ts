import { buildRatioSeries, indexedAxisDomain } from "../ratioSeries"

describe("indexedAxisDomain", () => {
  it("covers every series it is given, so one scale carries them all", () => {
    // Price indexed to 1.0 and the ratio indexed to 1.0 share a single axis —
    // the domain has to hold both or one of them clips.
    const [min, max] = indexedAxisDomain([
      [1, 1.32],
      [1, 0.94],
    ])

    expect(min).toBeLessThan(0.94)
    expect(max).toBeGreaterThan(1.32)
  })

  it("keeps a flat pair looking flat instead of magnifying its noise", () => {
    // VOO against SPY barely moves, and neither does its price on a short
    // range. Scaling to dataMin/dataMax stretched a 0.3% wobble over the whole
    // pane and drew it as a crash.
    const [min, max] = indexedAxisDomain([
      [1, 1.002],
      [1, 0.999],
    ])

    expect(max - min).toBeGreaterThanOrEqual(0.05)
    expect(min).toBeLessThan(0.999)
    expect(max).toBeGreaterThan(1.002)
  })

  it("does not clip a series that genuinely moves", () => {
    const [min, max] = indexedAxisDomain([[1, 2.4, 0.62]])

    expect(min).toBeLessThan(0.62)
    expect(max).toBeGreaterThan(2.4)
  })

  it("ignores non-finite values rather than returning a NaN domain", () => {
    const [min, max] = indexedAxisDomain([[1, Number.NaN, 1.2], [undefined]])

    expect(Number.isFinite(min)).toBe(true)
    expect(Number.isFinite(max)).toBe(true)
    expect(max).toBeGreaterThan(1.2)
  })

  it("falls back to a band around the base when nothing is plottable", () => {
    const [min, max] = indexedAxisDomain([[undefined], []])

    expect(min).toBeLessThan(1)
    expect(max).toBeGreaterThan(1)
  })
})

describe("buildRatioSeries", () => {
  const dates = ["2026-01-02", "2026-01-03", "2026-01-06"]

  it("rebases the ratio to 1.0 at the first point both legs cover", () => {
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

    // Raw ratios: 0.30, 0.306, 0.28 → rebased 1.00, 1.02, 0.9333.
    expect(buildRatioSeries(dates, numerator, denominator)).toEqual([
      1,
      expect.closeTo(1.02, 6),
      expect.closeTo(0.9333, 4),
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

    // 2026-01-03 reuses the 2026-01-02 numerator, so the ratio is flat at 1.0.
    expect(buildRatioSeries(dates, numerator, denominator)).toEqual([
      1,
      1,
      expect.closeTo(1.1, 6),
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
    // first chart date, so the overlay always begins at 1.0.
    expect(buildRatioSeries(dates, numerator, denominator)).toEqual([
      undefined,
      1,
      expect.closeTo(1.2, 6),
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
      1,
      undefined,
      expect.closeTo(1.2, 6),
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
      1,
      expect.closeTo(1.1, 6),
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
      1,
      expect.closeTo(1.1, 6),
      expect.closeTo(1.2, 6),
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
      1,
      expect.closeTo(1.2, 6),
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
      1,
      1,
      expect.closeTo(1.2, 6),
    ])
  })
})

describe("buildRatioSeries with malformed feed values", () => {
  const dates = ["2026-01-01", "2026-01-02", "2026-01-03"]

  it("skips a point whose leg is not a finite number", () => {
    // A malformed close reaches here as NaN (Number("") or a null coerced by
    // the caller). Captured as the rebase base it turns every later point into
    // NaN, and the axis helper then computes a NaN domain that breaks the chart.
    const series = buildRatioSeries(
      dates,
      [
        { priceDate: dates[0], close: Number.NaN },
        { priceDate: dates[1], close: 110 },
        { priceDate: dates[2], close: 120 },
      ],
      dates.map((d) => ({ priceDate: d, close: 100 })),
    )

    expect(series[0]).toBeUndefined()
    expect(series[1]).toBe(1)
    expect(series.every((v) => v === undefined || Number.isFinite(v))).toBe(
      true,
    )
  })

  it("skips a point whose quotient overflows to infinity", () => {
    const series = buildRatioSeries(
      dates,
      dates.map((d) => ({ priceDate: d, close: 1e308 })),
      [
        { priceDate: dates[0], close: 1e-308 },
        { priceDate: dates[1], close: 1e308 },
        { priceDate: dates[2], close: 1e308 },
      ],
    )

    expect(series[0]).toBeUndefined()
    expect(series[1]).toBe(1)
  })

  it("skips a point whose denominator is not finite", () => {
    const series = buildRatioSeries(
      dates,
      dates.map((d) => ({ priceDate: d, close: 100 })),
      [
        { priceDate: dates[0], close: Number.POSITIVE_INFINITY },
        { priceDate: dates[1], close: 100 },
        { priceDate: dates[2], close: 100 },
      ],
    )

    expect(series[0]).toBeUndefined()
    expect(series[1]).toBe(1)
  })
})

describe("buildRatioSeries with an unparseable date", () => {
  it("does not treat a malformed price date as a recent close", () => {
    // Date.parse returns NaN, and NaN > MAX_CARRY_FORWARD_DAYS is false — so a
    // stale close would be handed back as if it were current, and could become
    // the rebase base for the whole series.
    // "2026-01-99" sorts inside the leg's range (so the string comparisons let
    // it through) but Date.parse cannot read it.
    const series = buildRatioSeries(
      ["2026-01-99"],
      [
        { priceDate: "2026-01-99", close: 110 },
        { priceDate: "2026-02-01", close: 120 },
      ],
      [
        { priceDate: "2026-01-99", close: 100 },
        { priceDate: "2026-02-01", close: 100 },
      ],
    )

    expect(series[0]).toBeUndefined()
  })
})
