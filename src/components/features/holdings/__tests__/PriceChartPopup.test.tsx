import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import PriceChartPopup from "../PriceChartPopup"
import useSwr from "swr"
import { makeAsset } from "@test-fixtures/beancounter"

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

jest.mock("recharts", () => ({
  ComposedChart: ({
    children,
    data,
  }: {
    children: React.ReactNode
    data: unknown[]
  }) => (
    <svg data-testid="chart" data-series={JSON.stringify(data)}>
      {children}
    </svg>
  ),
  Area: ({ dataKey }: { dataKey: string }) => (
    <g data-testid={`area-${dataKey}`} />
  ),
  Line: ({ dataKey }: { dataKey: string }) => (
    <g data-testid={`line-${dataKey}`} />
  ),
  Scatter: ({ dataKey }: { dataKey: string }) => (
    <g data-testid={`scatter-${dataKey}`} />
  ),
  ReferenceArea: ({ x1, fill }: { x1?: string; fill?: string }) => (
    <g data-testid="rs-band" data-from={x1} data-fill={fill} />
  ),
  ReferenceLine: ({ x, y }: { x?: string; y?: number }) =>
    x != null ? (
      <g data-testid={`refline-${x}`} />
    ) : (
      <g data-testid={`refline-y-${y}`} />
    ),
  XAxis: () => <g />,
  YAxis: ({ yAxisId }: { yAxisId?: string }) => (
    <g data-testid={`yaxis-${yAxisId ?? "default"}`} />
  ),
  Tooltip: () => <g />,
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

describe("PriceChartPopup", () => {
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

  it("defaults to the 6m range with SMA 20 on", () => {
    mockUseSwr.mockImplementation(makeRouter({}) as typeof useSwr)

    renderPopup()

    expect(screen.getByRole("button", { name: "6m" })).toHaveClass(
      "bg-wealth-600",
    )
    expect(screen.getByRole("button", { name: "SMA 20" })).toHaveClass(
      "bg-indigo-600",
    )
    expect(screen.getByTestId("line-sma")).toBeInTheDocument()
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

  it("renders the SMA line when a window is selected", () => {
    mockUseSwr.mockImplementation(makeRouter({}) as typeof useSwr)

    renderPopup()

    fireEvent.click(screen.getByRole("button", { name: "SMA 20" }))
    expect(screen.getByTestId("line-sma")).toBeInTheDocument()
  })

  it("draws no ratio overlay and resolves no extra assets by default", () => {
    mockUseSwr.mockImplementation(makeRouter({}) as typeof useSwr)

    renderPopup()

    expect(screen.getByRole("button", { name: "None" })).toHaveClass(
      "bg-sky-600",
    )
    expect(screen.queryByTestId("line-ratio")).not.toBeInTheDocument()
    expect(screen.queryByTestId("yaxis-ratio")).not.toBeInTheDocument()
    expect(resolveKeys()).toHaveLength(0)
  })

  it("plots RSP/SPY rebased to 100 on its own axis when selected", () => {
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
    // Ratio shares the plot with price, so it needs its own right-hand axis.
    expect(screen.getByTestId("yaxis-price")).toBeInTheDocument()
    expect(screen.getByTestId("yaxis-ratio")).toBeInTheDocument()

    const rows = JSON.parse(
      screen.getByTestId("chart").getAttribute("data-series") as string,
    ) as Array<{ ratio?: number }>
    expect(rows.map((r) => r.ratio)).toEqual([
      100,
      expect.closeTo(102, 6),
      expect.closeTo(93.33, 2),
    ])
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
      100,
      expect.closeTo(102.5, 6),
      expect.closeTo(100, 6),
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
    expect(rows[1].ratio).toBe(100)
    expect(rows[2]).toEqual(
      expect.objectContaining({ ratio: expect.closeTo(105, 6) }),
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

      expect(screen.getByText("Outperforming")).toBeInTheDocument()
      expect(screen.getByText(/vs SPY:/)).toBeInTheDocument()
    })

    it("describes breadth — not the asset — when the overlay is RSP/SPY", () => {
      // Same asset, different ratio: the ribbon must not keep talking about the
      // asset's own performance when the line on screen is a market read.
      renderWithLegs({
        "rsp-id": legHistory(12, 0.01),
        "spy-id": legHistory(12, 0),
      })

      fireEvent.click(screen.getByRole("button", { name: "RSP/SPY" }))

      expect(screen.getByText("Breadth widening")).toBeInTheDocument()
      expect(screen.queryByText("Outperforming")).not.toBeInTheDocument()
    })

    it("reports how the range split, in the overlay's own words", () => {
      renderWithLegs({
        "rsp-id": legHistory(12, -0.01),
        "spy-id": legHistory(12, 0),
      })

      fireEvent.click(screen.getByRole("button", { name: "RSP/SPY" }))

      expect(
        screen.getByText(/% breadth widening · \d+% breadth narrowing/),
      ).toBeInTheDocument()
    })

    it("draws one band per run of state, not one per trading day", () => {
      renderWithLegs({ "spy-id": legHistory(12, 0) })

      fireEvent.click(screen.getByRole("button", { name: "vs SPY" }))

      const bands = screen.getAllByTestId("rs-band")
      expect(bands.length).toBeGreaterThan(0)
      expect(bands.length).toBeLessThan(12)
    })

    it("drops the ribbon when the chosen overlay cannot be loaded", () => {
      renderWithLegs({})

      fireEvent.click(screen.getByRole("button", { name: "vs SPY" }))

      expect(screen.queryAllByTestId("rs-band")).toHaveLength(0)
    })
  })
})
