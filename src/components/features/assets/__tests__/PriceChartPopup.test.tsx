import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import PriceChartPopup, { parseDefaultSmas } from "../PriceChartPopup"
import useSwr from "swr"
import { makeAsset } from "@test-fixtures/beancounter"
import { localIsoDate } from "@lib/formatters"

jest.mock("swr", () => ({
  __esModule: true,
  default: jest.fn(),
  mutate: jest.fn(),
}))
const mockUseSwr = useSwr as jest.MockedFunction<typeof useSwr>

const mockUsePermissions = jest.fn(() => ({
  ai: false,
  preview: false,
  admin: false,
  isLoading: false,
}))
jest.mock("@hooks/usePermissions", () => ({
  __esModule: true,
  usePermissions: () => mockUsePermissions(),
}))

let lastSeries: Record<string, unknown>[] = []

jest.mock("recharts", () => ({
  ComposedChart: ({
    children,
    data,
  }: {
    children: React.ReactNode
    data: Record<string, unknown>[]
  }) => {
    lastSeries = data
    return (
      <svg data-testid="chart" data-series={JSON.stringify(data)}>
        {children}
      </svg>
    )
  },
  Area: ({ dataKey }: { dataKey: string }) => (
    <g data-testid={`area-${dataKey}`} />
  ),
  Line: ({ dataKey }: { dataKey: string }) => (
    <g data-testid={`line-${dataKey}`} />
  ),
  Scatter: ({ dataKey }: { dataKey: string }) => (
    <g data-testid={`scatter-${dataKey}`} />
  ),
  ReferenceArea: ({
    x1,
    x2,
    fill,
  }: {
    x1?: string
    x2?: string
    fill?: string
  }) => (
    <g data-testid="rs-band" data-from={x1} data-to={x2} data-fill={fill} />
  ),
  ReferenceLine: ({ x, y }: { x?: string; y?: number }) =>
    x != null ? (
      <g data-testid={`refline-${x}`} />
    ) : (
      <g data-testid={`refline-y-${y}`} />
    ),
  XAxis: () => <g />,
  // The tick label is what says whether the axis is money or an index, so the
  // stub runs the formatter over a sample value and publishes the result.
  YAxis: ({
    yAxisId,
    tickFormatter,
    domain,
  }: {
    yAxisId?: string
    tickFormatter?: (v: number) => string
    domain?: [number, number]
  }) => (
    <g
      data-testid={`yaxis-${yAxisId ?? "default"}`}
      data-tick={tickFormatter ? tickFormatter(1.05) : ""}
      data-domain={JSON.stringify(domain)}
    />
  ),
  // Render the tooltip's own content against the last charted point, so what
  // the user would actually read on hover is assertable.
  Tooltip: ({
    content,
  }: {
    content: React.ReactElement<Record<string, unknown>>
  }) => {
    const point = lastSeries[lastSeries.length - 1]
    if (!point) return <g />
    return (
      <div data-testid="tooltip">
        {React.cloneElement(content, {
          active: true,
          payload: [{ dataKey: "close", value: point.close, payload: point }],
        })}
      </div>
    )
  },
  CartesianGrid: () => <g />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}))

const asset = makeAsset({
  id: "msft-id",
  code: "MSFT",
  name: "Microsoft",
  assetCategory: { id: "EQUITY", name: "Equity" },
})

const history = {
  asset,
  prices: [
    { priceDate: "2026-03-21", close: 400 },
    { priceDate: "2026-04-01", close: 410 },
    { priceDate: "2026-04-20", close: 420 },
  ],
}

type SwrMock = (key: unknown) => ReturnType<typeof useSwr>

function makeRouter(options: {
  pricesResult?: ReturnType<typeof useSwr>
  tradesResult?: ReturnType<typeof useSwr>
  overlayLegs?: Record<string, { priceDate: string; close: number }[]>
  // History before the displayed range, fetched only while an SMA is on so
  // its first points have a full window behind them. Unset means none loaded.
  warmup?: { priceDate: string; close: number }[]
}): SwrMock {
  const prices = options.pricesResult ?? {
    data: history,
    isLoading: false,
    error: undefined,
  }
  const trades = options.tradesResult ?? {
    data: { data: [] },
    isLoading: false,
    error: undefined,
  }
  const idle = {
    data: undefined,
    isLoading: false,
    error: undefined,
  } as ReturnType<typeof useSwr>
  return (key) => {
    if (typeof key !== "string") return idle
    if (key.includes("/api/trns/trades/")) {
      return trades as ReturnType<typeof useSwr>
    }
    // Overlay legs resolve "US:RSP" to an asset id before their history is
    // fetched; the stub mints a predictable "<code>-id" so the follow-on
    // history key can be routed back to the right leg fixture.
    if (key.startsWith("/api/assets/resolve")) {
      const code = decodeURIComponent(key.split("code=")[1] ?? "")
      const ticker = code.split(":").pop()?.toLowerCase() ?? ""
      return {
        data: { data: { id: `${ticker}-id` } },
        isLoading: false,
        error: undefined,
      } as unknown as ReturnType<typeof useSwr>
    }
    if (key.startsWith("/api/prices/history/")) {
      const assetId = key.slice("/api/prices/history/".length).split("?")[0]
      if (assetId !== asset.id) {
        const leg = options.overlayLegs?.[assetId]
        return {
          data: leg ? { asset, prices: leg } : undefined,
          isLoading: false,
          error: undefined,
        } as unknown as ReturnType<typeof useSwr>
      }
      // The displayed range always ends today; a request ending earlier is the
      // SMA warm-up.
      if (!key.includes(`to=${localIsoDate(new Date())}`)) {
        return {
          data: options.warmup ? { asset, prices: options.warmup } : undefined,
          isLoading: false,
          error: undefined,
        } as unknown as ReturnType<typeof useSwr>
      }
    }
    return prices as ReturnType<typeof useSwr>
  }
}

function renderPopup(
  overrides: Partial<{
    portfolioId: string
    portfolios: string[]
    limitPrice: number
    limitLabel: string
  }> = {},
): ReturnType<typeof render> {
  return render(
    <PriceChartPopup
      asset={asset}
      currencySymbol="$"
      portfolioId={
        overrides.portfolios ? undefined : (overrides.portfolioId ?? "pf-1")
      }
      portfolios={overrides.portfolios}
      limitPrice={overrides.limitPrice}
      limitLabel={overrides.limitLabel}
      onClose={jest.fn()}
    />,
  )
}

function tradesKeys(): string[] {
  return mockUseSwr.mock.calls
    .map((call) => call[0])
    .filter(
      (k): k is string =>
        typeof k === "string" && k.includes("/api/trns/trades/"),
    )
}

function resolveKeys(): string[] {
  return mockUseSwr.mock.calls
    .map((call) => call[0])
    .filter(
      (k): k is string =>
        typeof k === "string" && k.startsWith("/api/assets/resolve"),
    )
    .filter((k, i, all) => all.indexOf(k) === i)
}

function assetHistoryKeys(): string[] {
  return mockUseSwr.mock.calls
    .map((call) => call[0])
    .filter(
      (k): k is string =>
        typeof k === "string" &&
        k.startsWith(`/api/prices/history/${asset.id}?`),
    )
}

function param(key: string, name: string): string {
  return new URLSearchParams(key.split("?")[1]).get(name) ?? ""
}

// The displayed range is the history request that ends latest; anything
// ending earlier is the SMA warm-up.
function mainHistoryKey(): string {
  return assetHistoryKeys().reduce((a, b) =>
    param(b, "to") > param(a, "to") ? b : a,
  )
}

// Consecutive calendar days ending the day before `end`, so a warm-up fixture
// always sits wholly before the displayed range.
function daysBefore(
  end: string,
  closes: number[],
): {
  priceDate: string
  close: number
}[] {
  const endDate = new Date(`${end}T00:00:00Z`)
  return closes.map((close, i) => {
    const d = new Date(endDate)
    d.setUTCDate(d.getUTCDate() - (closes.length - i))
    return { priceDate: d.toISOString().slice(0, 10), close }
  })
}

function chartRows(): Array<Record<string, number | undefined | null>> {
  return JSON.parse(
    screen.getByTestId("chart").getAttribute("data-series") as string,
  )
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length
}

describe("PriceChartPopup", () => {
  // The popup's default 6m window is anchored on today's date, and the
  // fixtures sit in March-April 2026. Pin the clock so the trades stay inside
  // the window; without this the suite started failing on 2026-09-29.
  beforeAll(() => {
    jest.useFakeTimers({
      now: new Date("2026-04-25T00:00:00Z"),
      doNotFake: [
        "setTimeout",
        "clearTimeout",
        "setInterval",
        "clearInterval",
        "setImmediate",
        "clearImmediate",
        "nextTick",
        "queueMicrotask",
        "requestAnimationFrame",
        "cancelAnimationFrame",
        "requestIdleCallback",
        "cancelIdleCallback",
        "performance",
        "hrtime",
      ],
    })
  })
  afterAll(() => {
    jest.useRealTimers()
  })

  beforeEach(() => {
    mockUseSwr.mockReset()
    mockUsePermissions.mockReturnValue({
      ai: false,
      preview: false,
      admin: false,
      isLoading: false,
    })
  })

  it("renders the chart with the asset name and close price", () => {
    mockUseSwr.mockImplementation(makeRouter({}) as typeof useSwr)

    renderPopup()

    expect(screen.getByText("Microsoft")).toBeInTheDocument()
    expect(screen.getByTestId("area-close")).toBeInTheDocument()
    expect(screen.getByText(/5\.00%/)).toBeInTheDocument()
  })

  it("draws a limit reference line and the gap vs close when a limit is given", () => {
    mockUseSwr.mockImplementation(makeRouter({}) as typeof useSwr)

    // Latest close is 420; a 415 limit sits 1.20% below market.
    renderPopup({ limitPrice: 415 })

    expect(screen.getByTestId("refline-y-415")).toBeInTheDocument()
    expect(screen.getByText("Limit")).toBeInTheDocument()
    expect(screen.getByText(/\$415\.00/)).toBeInTheDocument()
    // Market (close) is above the limit → positive gap.
    expect(screen.getByText(/\+1\.20% vs limit/)).toBeInTheDocument()
  })

  it("omits the limit reference line when no limit is supplied", () => {
    mockUseSwr.mockImplementation(makeRouter({}) as typeof useSwr)

    renderPopup()

    expect(screen.queryByText("Limit")).not.toBeInTheDocument()
  })

  it("colours each selected SMA button as its line and leaves the others plain", () => {
    mockUseSwr.mockImplementation(makeRouter({}) as typeof useSwr)

    renderPopup()
    fireEvent.click(screen.getByRole("button", { name: "SMA 200" }))

    expect(screen.getByRole("button", { name: "SMA 200" })).toHaveStyle({
      backgroundColor: "#D97706",
    })
    expect(
      screen.getByRole("button", { name: "SMA 50" }).style.backgroundColor,
    ).toBe("")
  })

  it("defaults to the 6m range with SMA 20 on", () => {
    mockUseSwr.mockImplementation(makeRouter({}) as typeof useSwr)

    renderPopup()

    expect(screen.getByRole("button", { name: "6m" })).toHaveClass(
      "bg-wealth-600",
    )
    // A selected button wears its line's colour, so the buttons key the lines.
    expect(screen.getByRole("button", { name: "SMA 20" })).toHaveStyle({
      backgroundColor: "#6366F1",
    })
    expect(screen.getByRole("button", { name: "SMA 20" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    expect(screen.getByRole("button", { name: "SMA 50" })).toHaveAttribute(
      "aria-pressed",
      "false",
    )
    expect(screen.getByTestId("line-sma20")).toBeInTheDocument()
    expect(screen.queryByTestId("line-sma50")).not.toBeInTheDocument()
    expect(screen.queryByTestId("line-sma200")).not.toBeInTheDocument()
  })

  it("refetches prices with a new range when a period tab is clicked", () => {
    mockUseSwr.mockImplementation(makeRouter({}) as typeof useSwr)

    renderPopup()

    fireEvent.click(screen.getByRole("button", { name: "12m" }))

    const priceKeys = mockUseSwr.mock.calls
      .map((call) => call[0])
      .filter(
        (k): k is string =>
          typeof k === "string" && k.startsWith("/api/prices/history/"),
      )
    const latest = priceKeys[priceKeys.length - 1]
    expect(latest).toContain(`/api/prices/history/${asset.id}`)
    expect(latest).toContain("from=")
    expect(latest).toContain("to=")
  })

  it.each([
    ["just after local midnight", 0, 30],
    ["just before local midnight", 23, 30],
  ])(
    "ends the price range on the local calendar date %s",
    (_label, hour, minute) => {
      // Built from local fields, so in any zone other than UTC one of these
      // instants falls on a different UTC date.
      jest.setSystemTime(new Date(2026, 3, 25, hour, minute))
      try {
        mockUseSwr.mockImplementation(makeRouter({}) as typeof useSwr)

        renderPopup()

        expect(mainHistoryKey()).toContain("to=2026-04-25")
      } finally {
        jest.setSystemTime(new Date("2026-04-25T00:00:00Z"))
      }
    },
  )

  describe("simple moving average", () => {
    it("offers no Off button: SMAs are independent toggles", () => {
      mockUseSwr.mockImplementation(makeRouter({}) as typeof useSwr)

      renderPopup()

      expect(
        screen.queryByRole("button", { name: "Off" }),
      ).not.toBeInTheDocument()
    })

    it("draws several SMAs at once, one line each", () => {
      mockUseSwr.mockImplementation(makeRouter({}) as typeof useSwr)

      renderPopup()
      fireEvent.click(screen.getByRole("button", { name: "SMA 50" }))
      fireEvent.click(screen.getByRole("button", { name: "SMA 200" }))

      expect(screen.getByTestId("line-sma20")).toBeInTheDocument()
      expect(screen.getByTestId("line-sma50")).toBeInTheDocument()
      expect(screen.getByTestId("line-sma200")).toBeInTheDocument()
      for (const name of ["SMA 20", "SMA 50", "SMA 200"]) {
        expect(screen.getByRole("button", { name })).toHaveAttribute(
          "aria-pressed",
          "true",
        )
      }
    })

    it("toggling one SMA off removes only its line", () => {
      mockUseSwr.mockImplementation(makeRouter({}) as typeof useSwr)

      renderPopup()
      fireEvent.click(screen.getByRole("button", { name: "SMA 200" }))
      fireEvent.click(screen.getByRole("button", { name: "SMA 20" }))

      expect(screen.queryByTestId("line-sma20")).not.toBeInTheDocument()
      expect(screen.getByTestId("line-sma200")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "SMA 20" })).toHaveAttribute(
        "aria-pressed",
        "false",
      )
    })

    it("sizes the warm-up by the longest selected window", () => {
      mockUseSwr.mockImplementation(makeRouter({}) as typeof useSwr)
      const day = 24 * 60 * 60 * 1000
      const latestWarmSpan = (): number => {
        const main = mainHistoryKey()
        const warm = assetHistoryKeys()
          .filter((k) => param(k, "to") < param(main, "to"))
          .pop() as string
        const warmTo = new Date(`${param(warm, "to")}T00:00:00Z`)
        const warmFrom = new Date(`${param(warm, "from")}T00:00:00Z`)
        return (warmTo.getTime() - warmFrom.getTime()) / day
      }

      renderPopup()
      fireEvent.click(screen.getByRole("button", { name: "SMA 50" }))
      // 50 trading days: more than 70 calendar days, well short of 200's.
      expect(latestWarmSpan()).toBeGreaterThan(70)
      expect(latestWarmSpan()).toBeLessThan(150)

      fireEvent.click(screen.getByRole("button", { name: "SMA 200" }))
      expect(latestWarmSpan()).toBeGreaterThan(290)

      // Turning the short windows off leaves 200 in charge of the warm-up.
      fireEvent.click(screen.getByRole("button", { name: "SMA 20" }))
      fireEvent.click(screen.getByRole("button", { name: "SMA 50" }))
      expect(latestWarmSpan()).toBeGreaterThan(290)

      fireEvent.click(screen.getByRole("button", { name: "SMA 200" }))
      fireEvent.click(screen.getByRole("button", { name: "SMA 50" }))
      expect(latestWarmSpan()).toBeLessThan(150)
    })

    it("gives each selected window its own series and tooltip row", () => {
      const warmCloses = Array.from({ length: 250 }, (_, i) => i + 1)
      mockUseSwr.mockImplementation(
        makeRouter({
          warmup: daysBefore("2026-03-21", warmCloses),
        }) as typeof useSwr,
      )

      renderPopup()
      fireEvent.click(screen.getByRole("button", { name: "SMA 200" }))

      const rows = chartRows()
      const combined = [...warmCloses, ...history.prices.map((p) => p.close)]
      const last = combined.length
      expect(rows[2].sma20).toBeCloseTo(mean(combined.slice(last - 20)), 6)
      expect(rows[2].sma200).toBeCloseTo(mean(combined.slice(last - 200)), 6)
      expect(rows[2].sma50).toBeUndefined()

      const tooltip = screen.getByTestId("tooltip")
      expect(tooltip).toHaveTextContent("SMA 20:")
      expect(tooltip).toHaveTextContent("SMA 200:")
      expect(tooltip).not.toHaveTextContent("SMA 50:")
    })

    it("keeps every selected SMA inside the price axis", () => {
      // A long run of high closes puts SMA 200 far above the displayed range.
      mockUseSwr.mockImplementation(
        makeRouter({
          warmup: daysBefore("2026-03-21", new Array(250).fill(2000)),
        }) as typeof useSwr,
      )

      renderPopup()
      fireEvent.click(screen.getByRole("button", { name: "SMA 200" }))

      const top = Math.max(
        ...chartRows().map((r) => (r.sma200 as number | undefined) ?? 0),
      )
      expect(top).toBeGreaterThan(1900)
      const domain = JSON.parse(
        screen.getByTestId("yaxis-price").getAttribute("data-domain") as string,
      ) as [number, number]
      expect(domain[1]).toBeGreaterThanOrEqual(top)
    })

    it("offers a 200-day SMA", () => {
      mockUseSwr.mockImplementation(makeRouter({}) as typeof useSwr)

      renderPopup()

      expect(
        screen.getByRole("button", { name: "SMA 200" }),
      ).toBeInTheDocument()
    })

    it("requests warm-up history ending the day before the displayed range", () => {
      mockUseSwr.mockImplementation(makeRouter({}) as typeof useSwr)

      renderPopup()
      fireEvent.click(screen.getByRole("button", { name: "SMA 200" }))

      const main = mainHistoryKey()
      // The latest warm-up request is SMA 200's; the default SMA 20 made one
      // on first render.
      const warm = assetHistoryKeys()
        .filter((k) => param(k, "to") < param(main, "to"))
        .pop() as string
      expect(warm).toBeDefined()
      const rangeStart = new Date(`${param(main, "from")}T00:00:00Z`)
      const warmTo = new Date(`${param(warm, "to")}T00:00:00Z`)
      const warmFrom = new Date(`${param(warm, "from")}T00:00:00Z`)
      const day = 24 * 60 * 60 * 1000
      expect((rangeStart.getTime() - warmTo.getTime()) / day).toBe(1)
      // 200 trading days need ~290 calendar days; the request covers more.
      expect((warmTo.getTime() - warmFrom.getTime()) / day).toBeGreaterThan(290)
    })

    it("builds SMA 200 from the warm-up history, not a partial window", () => {
      const warmCloses = Array.from({ length: 250 }, (_, i) => i + 1)
      mockUseSwr.mockImplementation(
        makeRouter({
          warmup: daysBefore("2026-03-21", warmCloses),
        }) as typeof useSwr,
      )

      renderPopup()
      fireEvent.click(screen.getByRole("button", { name: "SMA 200" }))

      const rows = chartRows()
      const closes = history.prices.map((p) => p.close)
      const combined = [...warmCloses, ...closes]
      const firstShown = warmCloses.length
      expect(rows).toHaveLength(closes.length)
      expect(rows[0].sma200).toBeCloseTo(
        mean(combined.slice(firstShown - 199, firstShown + 1)),
        6,
      )
      expect(rows[2].sma200).toBeCloseTo(
        mean(combined.slice(firstShown - 197, firstShown + 3)),
        6,
      )
    })

    it("draws no SMA where the history is shorter than the window", () => {
      // 18 warm-up closes: the first displayed point has 19 behind it, the
      // second the full 20.
      const warmCloses = Array.from({ length: 18 }, (_, i) => 300 + i)
      mockUseSwr.mockImplementation(
        makeRouter({
          warmup: daysBefore("2026-03-21", warmCloses),
        }) as typeof useSwr,
      )

      renderPopup()

      const rows = chartRows()
      expect(rows[0].sma20).toBeUndefined()
      expect(rows[1].sma20).toBeCloseTo(
        mean([...warmCloses, 400, 410].slice(-20)),
        6,
      )
    })

    it("draws no SMA at all for an asset newer than the window", () => {
      mockUseSwr.mockImplementation(makeRouter({ warmup: [] }) as typeof useSwr)

      renderPopup()
      fireEvent.click(screen.getByRole("button", { name: "SMA 200" }))

      expect(chartRows().every((r) => r.sma200 === undefined)).toBe(true)
    })

    it("fetches no warm-up history when no SMA is selected", () => {
      mockUseSwr.mockImplementation(makeRouter({}) as typeof useSwr)

      renderPopup()
      fireEvent.click(screen.getByRole("button", { name: "SMA 20" }))
      mockUseSwr.mockClear()
      fireEvent.click(screen.getByRole("button", { name: "12m" }))

      const keys = assetHistoryKeys()
      expect(keys.length).toBeGreaterThan(0)
      const main = mainHistoryKey()
      expect(keys.every((k) => k === main)).toBe(true)
      expect(screen.queryByTestId("line-sma20")).not.toBeInTheDocument()
    })

    it.each([
      [undefined, [20]],
      ["", [20]],
      ["20", [20]],
      ["200", [200]],
      ["50,200", [50, 200]],
      [" 200 , 20 ", [20, 200]],
      ["0", []],
      ["50,7", [50]],
      ["7", [20]],
      ["abc", [20]],
    ])("reads the default SMAs from %p as %p", (raw, expected) => {
      expect(parseDefaultSmas(raw)).toEqual(expected)
    })
  })

  it("draws no ratio overlay and resolves no extra assets by default", () => {
    mockUseSwr.mockImplementation(makeRouter({}) as typeof useSwr)

    renderPopup()

    expect(screen.getByRole("button", { name: "None" })).toHaveClass(
      "bg-sky-600",
    )
    expect(screen.queryByTestId("line-ratio")).not.toBeInTheDocument()
    expect(screen.queryByTestId("yaxis-ratio")).not.toBeInTheDocument()
    // Nothing to compare against, so the axis stays in money.
    expect(screen.getByTestId("yaxis-price")).toHaveAttribute(
      "data-tick",
      "$1.05",
    )
    expect(screen.getByTestId("area-close")).toBeInTheDocument()
    expect(resolveKeys()).toHaveLength(0)
  })

  it("plots price and RSP/SPY on one scale, both indexed to 1.0", () => {
    mockUseSwr.mockImplementation(
      makeRouter({
        overlayLegs: {
          "rsp-id": [
            { priceDate: "2026-03-21", close: 180 },
            { priceDate: "2026-04-01", close: 183.6 },
            { priceDate: "2026-04-20", close: 176.4 },
          ],
          "spy-id": [
            { priceDate: "2026-03-21", close: 600 },
            { priceDate: "2026-04-01", close: 600 },
            { priceDate: "2026-04-20", close: 630 },
          ],
        },
      }) as typeof useSwr,
    )

    renderPopup()
    fireEvent.click(screen.getByRole("button", { name: "RSP/SPY" }))

    expect(resolveKeys()).toEqual(
      expect.arrayContaining([
        "/api/assets/resolve?code=US%3ARSP",
        "/api/assets/resolve?code=US%3ASPY",
      ]),
    )
    expect(screen.getByTestId("line-ratio")).toBeInTheDocument()
    // One scale, not two. A second axis lets the eye read crossings between
    // price and ratio that only exist because the scales were chosen that way.
    expect(screen.getByTestId("yaxis-price")).toBeInTheDocument()
    expect(screen.queryByTestId("yaxis-ratio")).not.toBeInTheDocument()
    // Money is no longer what the axis measures, so the symbol comes off.
    expect(screen.getByTestId("yaxis-price")).toHaveAttribute(
      "data-tick",
      "1.05",
    )

    const rows = JSON.parse(
      screen.getByTestId("chart").getAttribute("data-series") as string,
    ) as Array<{ ratio?: number; close: number; closeIndex?: number }>
    expect(rows.map((r) => r.ratio)).toEqual([
      1,
      expect.closeTo(1.02, 6),
      expect.closeTo(0.9333, 4),
    ])
    // Price is indexed against its own first close, and keeps the money value
    // for the header and tooltip.
    expect(rows.map((r) => r.closeIndex)).toEqual([
      1,
      expect.closeTo(1.025, 6),
      expect.closeTo(1.05, 6),
    ])
    expect(rows.map((r) => r.close)).toEqual([400, 410, 420])
    expect(screen.getByTestId("area-closeIndex")).toBeInTheDocument()
    expect(screen.queryByTestId("area-close")).not.toBeInTheDocument()
    // An index of 0.93 reads as a 6.7% fall, and the legend says so in percent
    // rather than making the reader subtract from 1.
    expect(screen.getByText(/-6\.7% over range/)).toBeInTheDocument()
  })

  it("indexes the limit line, the SMA and the trade markers with the price", () => {
    mockUseSwr.mockImplementation(
      makeRouter({
        // 19 closes at the base level, so the default SMA 20 at the first
        // displayed point (also 400) sits exactly on the base.
        warmup: daysBefore("2026-03-21", new Array(19).fill(400)),
        overlayLegs: {
          "spy-id": [
            { priceDate: "2026-03-21", close: 500 },
            { priceDate: "2026-04-01", close: 500 },
            { priceDate: "2026-04-20", close: 525 },
          ],
        },
        tradesResult: {
          data: {
            data: [
              {
                id: "t1",
                trnType: "BUY",
                tradeDate: "2026-04-01",
                quantity: 5,
                price: 380,
              },
            ],
          },
          isLoading: false,
          error: undefined,
        } as unknown as ReturnType<typeof useSwr>,
      }) as typeof useSwr,
    )

    // Base close is 400, so a 420 limit indexes to 1.05 and a 380 fill to 0.95.
    renderPopup({ limitPrice: 420 })
    fireEvent.click(screen.getByRole("button", { name: "vs SPY" }))

    const rows = JSON.parse(
      screen.getByTestId("chart").getAttribute("data-series") as string,
    ) as Array<{ buyIndex?: number | null; sma20Index?: number }>
    expect(rows.find((r) => r.buyIndex != null)?.buyIndex).toBeCloseTo(0.95, 6)
    expect(rows[0].sma20Index).toBeCloseTo(1, 6)
    expect(screen.getByTestId("scatter-buyIndex")).toBeInTheDocument()
    expect(screen.getByTestId("line-sma20Index")).toBeInTheDocument()
    // Anything left on the money scale would sit at the wrong height.
    expect(screen.getByTestId("refline-y-1.05")).toBeInTheDocument()
    // The label still quotes the limit in money — that is what was entered.
    expect(screen.getByText(/\$420\.00/)).toBeInTheDocument()
  })

  it("keeps a decimal for an overlay that barely moves, instead of reading flat", () => {
    // An asset against a benchmark it largely *is* moves fractions of a
    // percent. At one decimal every day of that reads "+0.0%", which says the
    // overlay is flat when it is not.
    mockUseSwr.mockImplementation(
      makeRouter({
        overlayLegs: {
          "spy-id": [
            { priceDate: "2026-03-21", close: 500 },
            { priceDate: "2026-04-01", close: 512.5 },
            { priceDate: "2026-04-20", close: 524.79 },
          ],
        },
      }) as typeof useSwr,
    )

    renderPopup()
    fireEvent.click(screen.getByRole("button", { name: "vs SPY" }))

    // MSFT is up 5.00% on the range, SPY 4.958% — four hundredths of a percent
    // of relative strength.
    expect(screen.getByText(/\+0\.04% over range/)).toBeInTheDocument()
  })

  it("leaves a malformed close out of the indexed series rather than plotting NaN", () => {
    // A close that arrives unparseable is NaN, which passes `typeof "number"`.
    // Divided by the base it stays NaN, and recharts draws NaN as a dropped
    // segment or a marker at the wrong height rather than as a gap.
    mockUseSwr.mockImplementation(
      makeRouter({
        pricesResult: {
          data: {
            asset,
            prices: [
              { priceDate: "2026-03-21", close: 400 },
              { priceDate: "2026-04-01", close: Number.NaN },
              { priceDate: "2026-04-20", close: 420 },
            ],
          },
          isLoading: false,
          error: undefined,
        } as unknown as ReturnType<typeof useSwr>,
        overlayLegs: {
          "spy-id": [
            { priceDate: "2026-03-21", close: 500 },
            { priceDate: "2026-04-01", close: 500 },
            { priceDate: "2026-04-20", close: 525 },
          ],
        },
      }) as typeof useSwr,
    )

    renderPopup()
    fireEvent.click(screen.getByRole("button", { name: "vs SPY" }))

    const rows = JSON.parse(
      screen.getByTestId("chart").getAttribute("data-series") as string,
    ) as Array<{ closeIndex?: number | null }>
    // JSON drops an undefined key and writes NaN as null, so this tells the
    // two apart.
    expect(rows[1].closeIndex).toBeUndefined()
    expect(rows[0].closeIndex).toBe(1)
    expect(rows[2].closeIndex).toBeCloseTo(1.05, 6)
  })

  it("uses the charted asset as the numerator for a relative-strength overlay", () => {
    mockUseSwr.mockImplementation(
      makeRouter({
        overlayLegs: {
          "spy-id": [
            { priceDate: "2026-03-21", close: 500 },
            { priceDate: "2026-04-01", close: 500 },
            { priceDate: "2026-04-20", close: 525 },
          ],
        },
      }) as typeof useSwr,
    )

    renderPopup()
    fireEvent.click(screen.getByRole("button", { name: "vs SPY" }))

    // Only the denominator is resolved — the numerator is this asset's own
    // history, already fetched for the price area.
    expect(resolveKeys()).toEqual(["/api/assets/resolve?code=US%3ASPY"])

    const rows = JSON.parse(
      screen.getByTestId("chart").getAttribute("data-series") as string,
    ) as Array<{ ratio?: number }>
    // MSFT 400→410→420 against SPY 500→500→525: ahead, then behind.
    expect(rows.map((r) => r.ratio)).toEqual([
      1,
      expect.closeTo(1.025, 6),
      expect.closeTo(1, 6),
    ])
  })

  it("leaves the ratio undefined for dates the overlay legs do not cover yet", () => {
    mockUseSwr.mockImplementation(
      makeRouter({
        overlayLegs: {
          "rsp-id": [
            { priceDate: "2026-04-01", close: 180 },
            { priceDate: "2026-04-20", close: 189 },
          ],
          "spy-id": [
            { priceDate: "2026-04-01", close: 600 },
            { priceDate: "2026-04-20", close: 600 },
          ],
        },
      }) as typeof useSwr,
    )

    renderPopup()
    fireEvent.click(screen.getByRole("button", { name: "RSP/SPY" }))

    const rows = JSON.parse(
      screen.getByTestId("chart").getAttribute("data-series") as string,
    ) as Array<{ ratio?: number }>
    expect(rows[0].ratio).toBeUndefined()
    expect(rows[1].ratio).toBe(1)
    expect(rows[2]).toEqual(
      expect.objectContaining({ ratio: expect.closeTo(1.05, 6) }),
    )
  })

  it("says the overlay is unavailable when a leg fails to load", () => {
    mockUseSwr.mockImplementation(((key: unknown) => {
      const base = makeRouter({})(key)
      if (typeof key === "string" && key.startsWith("/api/assets/resolve")) {
        return {
          data: undefined,
          isLoading: false,
          error: new Error("boom"),
        } as unknown as ReturnType<typeof useSwr>
      }
      return base
    }) as unknown as typeof useSwr)

    renderPopup()
    fireEvent.click(screen.getByRole("button", { name: "RSP/SPY" }))

    // Without this the toggle stays lit while nothing is drawn, which reads
    // as "this asset has no breadth data" rather than "the fetch failed".
    expect(screen.getByText(/RSP\/SPY unavailable/)).toBeInTheDocument()
    expect(screen.queryByTestId("line-ratio")).not.toBeInTheDocument()
  })

  it("fetches trades from a single portfolio via the path form", () => {
    mockUseSwr.mockImplementation(makeRouter({}) as typeof useSwr)

    renderPopup({ portfolioId: "pf-1" })

    const keys = tradesKeys()
    expect(keys[keys.length - 1]).toBe(`/api/trns/trades/pf-1/${asset.id}`)
  })

  it("fetches trades across portfolios via the aggregated query form", () => {
    mockUseSwr.mockImplementation(makeRouter({}) as typeof useSwr)

    renderPopup({ portfolios: ["pf-1", "pf-2"] })

    const keys = tradesKeys()
    expect(keys[keys.length - 1]).toBe(
      `/api/trns/trades/${asset.id}?portfolios=pf-1%2Cpf-2`,
    )
  })

  it("renders buy and sell scatter series from trades", () => {
    mockUseSwr.mockImplementation(
      makeRouter({
        tradesResult: {
          data: {
            data: [
              {
                id: "t1",
                trnType: "BUY",
                tradeDate: "2026-04-01",
                quantity: 5,
                price: 405,
              },
              {
                id: "t2",
                trnType: "SELL",
                tradeDate: "2026-04-20",
                quantity: 2,
                price: 418,
              },
            ],
          },
          isLoading: false,
          error: undefined,
        } as unknown as ReturnType<typeof useSwr>,
      }) as typeof useSwr,
    )

    renderPopup()

    expect(screen.getByTestId("scatter-buyPrice")).toBeInTheDocument()
    expect(screen.getByTestId("scatter-sellPrice")).toBeInTheDocument()
  })

  describe("proposed trades", () => {
    const tradesOf = (
      trns: Record<string, unknown>[],
    ): ReturnType<typeof useSwr> =>
      ({
        data: { data: trns },
        isLoading: false,
        error: undefined,
      }) as unknown as ReturnType<typeof useSwr>

    const rowOn = (
      date: string,
    ): Record<string, number | string | null | undefined> =>
      (
        JSON.parse(
          screen.getByTestId("chart").getAttribute("data-series") as string,
        ) as Array<Record<string, number | string | null | undefined>>
      ).find((r) => r.priceDate === date) ?? {}

    it("leaves a proposed trade off the chart", () => {
      mockUseSwr.mockImplementation(
        makeRouter({
          tradesResult: tradesOf([
            {
              id: "t1",
              trnType: "SELL",
              status: "PROPOSED",
              tradeDate: "2026-04-20",
              quantity: 2,
              price: 418,
            },
          ]),
        }) as typeof useSwr,
      )

      renderPopup()

      expect(rowOn("2026-04-20").sellPrice).toBeNull()
      expect(screen.getByTestId("tooltip")).not.toHaveTextContent("Sell")
    })

    it("draws the settled trade when a proposed one shares its day", () => {
      mockUseSwr.mockImplementation(
        makeRouter({
          tradesResult: tradesOf([
            {
              id: "t1",
              trnType: "BUY",
              status: "PROPOSED",
              tradeDate: "2026-04-20",
              quantity: 7,
              price: 415,
            },
            {
              id: "t2",
              trnType: "BUY",
              status: "SETTLED",
              tradeDate: "2026-04-20",
              quantity: 3,
              price: 419,
            },
          ]),
        }) as typeof useSwr,
      )

      renderPopup()

      expect(rowOn("2026-04-20").buyPrice).toBe(419)
      expect(screen.getByTestId("tooltip")).toHaveTextContent("Buy 3 @")
    })
  })

  it("anchors a non-trading-day trade to the next available price date", () => {
    mockUseSwr.mockImplementation(
      makeRouter({
        tradesResult: {
          data: {
            data: [
              {
                id: "t1",
                trnType: "BUY",
                tradeDate: "2026-03-28",
                quantity: 3,
                price: 405,
              },
            ],
          },
          isLoading: false,
          error: undefined,
        } as unknown as ReturnType<typeof useSwr>,
      }) as typeof useSwr,
    )

    renderPopup()

    const chart = screen.getByTestId("chart")
    const rows = JSON.parse(
      chart.getAttribute("data-series") as string,
    ) as Array<{ priceDate: string; buyPrice: number | null }>
    const anchored = rows.find((r) => r.buyPrice !== null)
    expect(anchored?.priceDate).toBe("2026-04-01")
  })

  it("renders backend split-adjusted prices and marks the ex-date", () => {
    // svc-data adjusts pre-split closes server-side and normalises the
    // `split` column so only the canonical ex-date carries a non-1 value.
    // The chart renders the response verbatim.
    mockUseSwr.mockImplementation(
      makeRouter({
        pricesResult: {
          data: {
            asset: history.asset,
            prices: [
              { priceDate: "2026-04-03", close: 200, split: 1 },
              { priceDate: "2026-04-06", close: 200, split: 25 },
              { priceDate: "2026-04-07", close: 205, split: 1 },
            ],
          },
          isLoading: false,
          error: undefined,
        } as unknown as ReturnType<typeof useSwr>,
      }) as typeof useSwr,
    )

    renderPopup()

    const chart = screen.getByTestId("chart")
    const rows = JSON.parse(
      chart.getAttribute("data-series") as string,
    ) as Array<{
      priceDate: string
      close: number
      splitFactor: number
      split?: number
    }>
    expect(rows[0].close).toBe(200)
    expect(rows[0].splitFactor).toBe(1)
    expect(rows[0].split).toBeUndefined()
    expect(rows[1].close).toBe(200)
    expect(rows[1].split).toBe(25)
    expect(rows[2].close).toBe(205)
    expect(rows[2].split).toBeUndefined()
    // Backend normalises the split column so only one row keeps the marker.
    expect(rows.filter((r) => r.split !== undefined)).toHaveLength(1)
    expect(screen.getByTestId("refline-2026-04-06")).toBeInTheDocument()
  })

  it("shows an empty message when the range has no prices", () => {
    mockUseSwr.mockImplementation(
      makeRouter({
        pricesResult: {
          data: { asset: history.asset, prices: [] },
          isLoading: false,
          error: undefined,
        } as unknown as ReturnType<typeof useSwr>,
      }) as typeof useSwr,
    )

    renderPopup()

    expect(
      screen.getByText("No price history available for this period"),
    ).toBeInTheDocument()
  })

  it("shows an error message when the fetch fails", () => {
    mockUseSwr.mockImplementation(
      makeRouter({
        pricesResult: {
          data: undefined,
          isLoading: false,
          error: new Error("boom"),
        } as unknown as ReturnType<typeof useSwr>,
      }) as typeof useSwr,
    )

    renderPopup()

    expect(screen.getByText("Failed to load price history")).toBeInTheDocument()
  })

  describe("Repair splits admin action", () => {
    it("hides the Repair splits button from non-admin users", () => {
      mockUseSwr.mockImplementation(makeRouter({}) as typeof useSwr)
      // default mock: isAdmin = false
      renderPopup()
      expect(
        screen.queryByRole("button", { name: "Repair splits" }),
      ).not.toBeInTheDocument()
    })

    it("posts to the repair endpoint and surfaces the response when admin clicks", async () => {
      mockUsePermissions.mockReturnValue({
        ai: false,
        preview: false,
        admin: true,
        isLoading: false,
      })
      mockUseSwr.mockImplementation(makeRouter({}) as typeof useSwr)

      const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            stamped: 2,
            alreadyStamped: 0,
            missingRows: 1,
          }),
      } as Response)

      renderPopup()

      const button = screen.getByRole("button", { name: "Repair splits" })
      fireEvent.click(button)

      // Endpoint hit with the correct asset id and POST method.
      expect(fetchSpy).toHaveBeenCalledWith(
        `/api/prices/${asset.id}/repair-splits`,
        { method: "POST" },
      )

      // Response counters surface to the user.
      expect(
        await screen.findByText("Repaired: 2 stamped, 0 already, 1 missing"),
      ).toBeInTheDocument()

      fetchSpy.mockRestore()
    })

    it("surfaces a forbidden error if the server rejects the admin gate", async () => {
      mockUsePermissions.mockReturnValue({
        ai: false,
        preview: false,
        admin: true,
        isLoading: false,
      })
      mockUseSwr.mockImplementation(makeRouter({}) as typeof useSwr)

      const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        status: 403,
        json: () => Promise.resolve({}),
      } as Response)

      renderPopup()

      fireEvent.click(screen.getByRole("button", { name: "Repair splits" }))

      expect(
        await screen.findByText("Repair failed: Admin scope required"),
      ).toBeInTheDocument()

      fetchSpy.mockRestore()
    })
  })
  describe("trend ribbon", () => {
    // The overlay's own series decides the ribbon, so the fixture moves the
    // leg that the selected ratio divides by.
    // Consecutive real dates, so a gap can exceed the ratio's carry-forward.
    function dayHistory(
      days: number,
      perDay: number,
      base = 500,
    ): { priceDate: string; close: number }[] {
      return Array.from({ length: days }, (_, i) => ({
        priceDate: new Date(Date.UTC(2026, 3, 1 + i))
          .toISOString()
          .slice(0, 10),
        close: base * (1 + perDay) ** i,
      }))
    }

    function legHistory(
      days: number,
      perDay: number,
      base = 500,
    ): { priceDate: string; close: number }[] {
      return Array.from({ length: days }, (_, i) => ({
        priceDate: `2026-04-${String(i + 1).padStart(2, "0")}`,
        close: base * (1 + perDay) ** i,
      }))
    }

    function renderWithLegs(
      overlayLegs: Record<string, { priceDate: string; close: number }[]>,
    ): void {
      mockUseSwr.mockImplementation(
        makeRouter({
          pricesResult: {
            data: { asset, prices: legHistory(12, 0.01, 400) },
            isLoading: false,
            error: undefined,
          } as ReturnType<typeof useSwr>,
          overlayLegs,
        }) as typeof useSwr,
      )
      renderPopup()
    }

    it("shows no ribbon and fetches nothing extra until a ratio is chosen", () => {
      // Default overlay is None. Nothing is being compared, so there is nothing
      // for the ribbon to describe and no reason to fetch a benchmark.
      mockUseSwr.mockImplementation(makeRouter({}) as typeof useSwr)

      renderPopup()

      expect(screen.queryAllByTestId("rs-band")).toHaveLength(0)
      expect(resolveKeys()).toHaveLength(0)
    })

    it("describes the asset when the overlay is the asset against the market", () => {
      renderWithLegs({ "spy-id": legHistory(12, 0) })

      fireEvent.click(screen.getByRole("button", { name: "vs SPY" }))

      expect(screen.getAllByText("Outperforming").length).toBeGreaterThan(0)
      expect(screen.getAllByText(/vs SPY:/).length).toBeGreaterThan(0)
    })

    it("describes the market — not the asset — when the overlay is RSP/SPY", () => {
      // Same asset, different ratio: the ribbon must not keep talking about the
      // asset's own performance when the line on screen is a market read.
      renderWithLegs({
        "rsp-id": legHistory(12, 0.01),
        "spy-id": legHistory(12, 0),
      })

      fireEvent.click(screen.getByRole("button", { name: "RSP/SPY" }))

      expect(screen.getAllByText("Broadening").length).toBeGreaterThan(0)
      expect(screen.queryByText("Outperforming")).not.toBeInTheDocument()
    })

    it("reports how the range split, in the overlay's own words", () => {
      renderWithLegs({
        "rsp-id": legHistory(12, -0.01),
        "spy-id": legHistory(12, 0),
      })

      fireEvent.click(screen.getByRole("button", { name: "RSP/SPY" }))

      expect(
        screen.getByText(/% broadening · \d+% narrowing/),
      ).toBeInTheDocument()
    })

    it("names the trend on hover, in the overlay's words", () => {
      renderWithLegs({
        "rsp-id": legHistory(12, 0.01),
        "spy-id": legHistory(12, 0),
      })

      fireEvent.click(screen.getByRole("button", { name: "RSP/SPY" }))

      const tooltip = screen.getByTestId("tooltip")
      expect(tooltip).toHaveTextContent("Broadening")
    })

    it("draws one band per run of state, not one per trading day", () => {
      renderWithLegs({ "spy-id": legHistory(12, 0) })

      fireEvent.click(screen.getByRole("button", { name: "vs SPY" }))

      const bands = screen.getAllByTestId("rs-band")
      expect(bands.length).toBeGreaterThan(0)
      expect(bands.length).toBeLessThan(12)
    })

    it("breaks the ribbon at a hole rather than painting over it", () => {
      // The benchmark goes dark for a fortnight mid-range — longer than the
      // ratio will carry a close forward. One band spanning the blackout would
      // assert a trend through days nothing was known about.
      const prices = dayHistory(40, 0.004, 400)
      const benchmark = dayHistory(40, 0, 500).filter(
        (_, i) => i < 12 || i > 26,
      )
      mockUseSwr.mockImplementation(
        makeRouter({
          pricesResult: {
            data: { asset, prices },
            isLoading: false,
            error: undefined,
          } as ReturnType<typeof useSwr>,
          overlayLegs: { "spy-id": benchmark },
        }) as typeof useSwr,
      )
      renderPopup()

      fireEvent.click(screen.getByRole("button", { name: "vs SPY" }))

      const holeStart = prices[13].priceDate
      const holeEnd = prices[26].priceDate
      const spanning = screen.getAllByTestId("rs-band").filter((band) => {
        const from = band.getAttribute("data-from") ?? ""
        const to = band.getAttribute("data-to") ?? ""
        return from < holeStart && to > holeEnd
      })
      expect(spanning).toHaveLength(0)
    })

    it("drops the ribbon when the chosen overlay cannot be loaded", () => {
      renderWithLegs({})

      fireEvent.click(screen.getByRole("button", { name: "vs SPY" }))

      expect(screen.queryAllByTestId("rs-band")).toHaveLength(0)
    })
  })
})
