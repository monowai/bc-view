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
  ReferenceLine: ({ x }: { x: string }) => <g data-testid={`refline-${x}`} />,
  XAxis: () => <g />,
  YAxis: () => <g />,
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
  return (key) => {
    if (typeof key === "string" && key.includes("/api/trns/trades/")) {
      return trades as ReturnType<typeof useSwr>
    }
    return prices as ReturnType<typeof useSwr>
  }
}

function renderPopup(
  overrides: Partial<{ portfolioId: string; portfolios: string[] }> = {},
): ReturnType<typeof render> {
  return render(
    <PriceChartPopup
      asset={asset}
      currencySymbol="$"
      portfolioId={
        overrides.portfolios ? undefined : (overrides.portfolioId ?? "pf-1")
      }
      portfolios={overrides.portfolios}
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
})
