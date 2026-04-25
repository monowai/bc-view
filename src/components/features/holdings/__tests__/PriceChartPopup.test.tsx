import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import PriceChartPopup from "../PriceChartPopup"
import useSwr from "swr"
import { Asset } from "types/beancounter"

jest.mock("swr", () => ({
  __esModule: true,
  default: jest.fn(),
}))
const mockUseSwr = useSwr as jest.MockedFunction<typeof useSwr>

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

const asset: Asset = {
  id: "msft-id",
  code: "MSFT",
  name: "Microsoft",
  assetCategory: { id: "EQUITY", name: "Equity" },
  market: {
    code: "NASDAQ",
    name: "NASDAQ",
    currency: { code: "USD", symbol: "$", name: "US Dollar" },
  },
}

const history = {
  asset: {
    id: "msft-id",
    code: "MSFT",
    name: "Microsoft",
    market: {
      code: "NASDAQ",
      name: "NASDAQ",
      currency: { code: "USD", symbol: "$", name: "US Dollar" },
    },
    assetCategory: { id: "EQUITY", name: "Equity" },
  },
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
  overrides: Partial<{ portfolioId: string }> = {},
): ReturnType<typeof render> {
  return render(
    <PriceChartPopup
      asset={asset}
      currencySymbol="$"
      portfolioId={overrides.portfolioId ?? "pf-1"}
      onClose={jest.fn()}
    />,
  )
}

describe("PriceChartPopup", () => {
  beforeEach(() => {
    mockUseSwr.mockReset()
  })

  it("renders the chart with the asset name and close price", () => {
    mockUseSwr.mockImplementation(makeRouter({}) as typeof useSwr)

    renderPopup()

    expect(screen.getByText("Microsoft")).toBeInTheDocument()
    expect(screen.getByTestId("area-close")).toBeInTheDocument()
    expect(screen.getByText(/5\.00%/)).toBeInTheDocument()
  })

  it("defaults to the 1m range and SMA off", () => {
    mockUseSwr.mockImplementation(makeRouter({}) as typeof useSwr)

    renderPopup()

    expect(screen.getByRole("button", { name: "1m" })).toHaveClass(
      "bg-wealth-600",
    )
    expect(screen.getByRole("button", { name: "Off" })).toHaveClass(
      "bg-indigo-600",
    )
    expect(screen.queryByTestId("line-sma")).not.toBeInTheDocument()
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
    expect(rows[1].close).toBe(200)
    expect(rows[1].split).toBe(25)
    expect(rows[2].close).toBe(205)
    expect(rows[2].split).toBeUndefined()
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
})
