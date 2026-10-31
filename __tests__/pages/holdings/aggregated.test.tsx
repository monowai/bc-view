import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import {
  makeAsset,
  makeHoldingGroup,
  makeHoldings,
  makePortfolio,
  makePosition,
} from "@test-fixtures/beancounter"

const mockRouterQuery: Record<string, string> = {}
let mockRouterReady = true

jest.mock("next/router", () => ({
  useRouter: (): Record<string, unknown> => ({
    query: mockRouterQuery,
    isReady: mockRouterReady,
    push: jest.fn(),
    events: { on: jest.fn(), off: jest.fn() },
  }),
}))

jest.mock("swr", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    data: undefined,
    error: undefined,
    isLoading: false,
    mutate: jest.fn(),
  })),
  mutate: jest.fn(),
}))

jest.mock("@hooks/usePermissions", () => ({
  usePermissions: () => ({
    ai: false,
    preview: false,
    admin: false,
    isLoading: false,
  }),
}))

// The popup's own content is covered by SectorWeightingsPopup.test.tsx —
// here we only care that the aggregated page opens it.
jest.mock("@components/features/portfolios/SectorWeightingsPopup", () => ({
  __esModule: true,
  default: ({ asset }: { asset: { code: string } }) => (
    <div data-testid="sector-weightings-popup">{asset.code}</div>
  ),
}))

let capturedTradeProps: Record<string, unknown> | null = null
jest.mock("@components/features/transactions/TradeInputForm", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    capturedTradeProps = props
    return <div data-testid="trade-form" />
  },
}))

const etf = makeAsset({
  id: "asset-voo",
  code: "VOO",
  name: "Vanguard S&P 500",
  assetCategory: { id: "ETF", name: "ETF" },
})

const holdings = makeHoldings({
  holdingGroups: {
    ETF: makeHoldingGroup({ positions: [makePosition({ asset: etf })] }),
  },
})

// Mutated per test so the same page renders in table and card mode.
let mockViewMode = "table"

jest.mock("@lib/holdings/useHoldingsView", () => ({
  useHoldingsView: (): Record<string, unknown> => ({
    viewMode: mockViewMode,
    setViewMode: jest.fn(),
    sortConfig: { key: "assetName", direction: "asc" },
    allocationGroupBy: "assetClass",
    excludedCategories: new Set<string>(),
    handleSort: jest.fn(),
    handleToggleCategory: jest.fn(),
    holdings,
    allocationData: [],
    allocationTotalValue: 0,
  }),
}))

import useSwr from "swr"
import AggregatedHoldings from "@pages/holdings/aggregated"

const AggregatedHoldingsPage = AggregatedHoldings as React.ComponentType<
  Record<string, unknown>
>

const holdingContract = {
  portfolio: makePortfolio(),
  isMixedCurrencies: false,
  asAt: "2026-08-21",
  positions: {},
  totals: {},
}

describe("Aggregated holdings — sector weightings", () => {
  beforeEach(() => {
    ;(useSwr as unknown as jest.Mock).mockImplementation((key: unknown) => {
      if (typeof key === "string" && key.startsWith("/api/holdings/aggregated"))
        return {
          data: { data: holdingContract },
          error: undefined,
          isLoading: false,
          mutate: jest.fn(),
        }
      return {
        data: undefined,
        error: undefined,
        isLoading: false,
        mutate: jest.fn(),
      }
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
    mockViewMode = "table"
  })

  it.each(["table", "cards"])(
    "offers View Sectors on a fund-like holding and opens the popup (%s view)",
    (mode) => {
      mockViewMode = mode
      render(<AggregatedHoldingsPage />)

      // Card groups start collapsed — open the group to reach its cards.
      if (mode === "cards") {
        fireEvent.click(screen.getByRole("button", { name: /^ETF/ }))
      }
      fireEvent.click(screen.getByRole("button", { name: /Actions VOO/i }))
      fireEvent.click(screen.getByRole("button", { name: "View Sectors" }))

      expect(screen.getByTestId("sector-weightings-popup")).toHaveTextContent(
        "VOO",
      )
    },
  )
})

describe("Aggregated holdings — trade a new asset", () => {
  const closed = makePortfolio({ id: "pf-old", code: "OLD", active: false })
  const growth = makePortfolio({ id: "pf-growth", code: "GROWTH" })

  beforeEach(() => {
    capturedTradeProps = null
    ;(useSwr as unknown as jest.Mock).mockImplementation((key: unknown) => {
      if (typeof key === "string" && key.startsWith("/api/holdings/aggregated"))
        return {
          data: { data: holdingContract },
          error: undefined,
          isLoading: false,
          mutate: jest.fn(),
        }
      if (typeof key === "string" && key.startsWith("/api/portfolios"))
        return {
          data: { data: [closed, growth] },
          error: undefined,
          isLoading: false,
          mutate: jest.fn(),
        }
      return {
        data: undefined,
        error: undefined,
        isLoading: false,
        mutate: jest.fn(),
      }
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it("opens a blank BUY trade against a real, active portfolio", () => {
    render(<AggregatedHoldingsPage />)

    expect(screen.queryByTestId("trade-form")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Trade an asset" }))

    expect(screen.getByTestId("trade-form")).toBeInTheDocument()
    expect((capturedTradeProps?.portfolio as { id: string }).id).toBe(
      "pf-growth",
    )
    // No seed — TradeInputForm opens its blank new-trade (BUY) form.
    expect(capturedTradeProps?.initialValues).toBeUndefined()
  })
})

describe("Aggregated holdings — income scope", () => {
  const growth = makePortfolio({ id: "pf-growth", code: "GROWTH" })
  const yieldPf = makePortfolio({ id: "pf-yield", code: "YIELD" })
  const other = makePortfolio({ id: "pf-other", code: "OTHER" })

  function respond(portfolios: unknown, portfoliosError?: Error): void {
    ;(useSwr as unknown as jest.Mock).mockImplementation((key: unknown) => {
      const isPortfolios =
        typeof key === "string" && key.startsWith("/api/portfolios")
      const data =
        typeof key === "string" && key.startsWith("/api/holdings/aggregated")
          ? { data: holdingContract }
          : isPortfolios
            ? portfolios
            : undefined
      return {
        data,
        error: isPortfolios ? portfoliosError : undefined,
        isLoading: false,
        mutate: jest.fn(),
      }
    })
  }

  function incomeRequests(): URLSearchParams[] {
    return (useSwr as unknown as jest.Mock).mock.calls
      .map(([key]) => key as unknown)
      .filter(
        (key): key is string =>
          typeof key === "string" && key.includes("/income/monthly"),
      )
      .map((key) => new URLSearchParams(key.split("?")[1]))
  }

  beforeEach(() => {
    mockViewMode = "income"
  })

  afterEach(() => {
    mockViewMode = "table"
    mockRouterReady = true
    delete mockRouterQuery.codes
    jest.clearAllMocks()
  })

  it("asks for income from the selected portfolios only", () => {
    mockRouterQuery.codes = "GROWTH,YIELD"
    respond({ data: [growth, yieldPf, other] })

    render(<AggregatedHoldingsPage />)

    expect(incomeRequests().at(-1)?.get("portfolioIds")).toBe(
      "pf-growth,pf-yield",
    )
  })

  it("sends no unscoped request while portfolios are loading", () => {
    mockRouterQuery.codes = "GROWTH"
    respond(undefined)

    render(<AggregatedHoldingsPage />)

    expect(incomeRequests()).toHaveLength(0)
  })

  it("sends nothing until the router knows the selected codes", () => {
    mockRouterReady = false
    respond({ data: [growth] })

    render(<AggregatedHoldingsPage />)

    expect(incomeRequests()).toHaveLength(0)
  })

  it("reports a failed portfolio lookup instead of loading forever", () => {
    mockRouterQuery.codes = "GROWTH"
    respond(undefined, new Error("portfolios unavailable"))

    render(<AggregatedHoldingsPage />)

    expect(incomeRequests()).toHaveLength(0)
    expect(screen.getByText(/Failed to load income data/)).toBeInTheDocument()
  })

  it("shows no income rather than everything when no selected code resolves", () => {
    mockRouterQuery.codes = "MISSING"
    respond({ data: [growth] })

    render(<AggregatedHoldingsPage />)

    expect(incomeRequests()).toHaveLength(0)
    expect(
      screen.getByText("None of the selected portfolios were found"),
    ).toBeInTheDocument()
  })

  it("leaves income unscoped when no portfolios were selected", () => {
    respond({ data: [growth] })

    render(<AggregatedHoldingsPage />)

    expect(incomeRequests().at(-1)?.has("portfolioIds")).toBe(false)
  })
})

describe("Aggregated holdings — portfolios in the view", () => {
  const breakdown = (code: string, quantity: number): object => ({
    portfolioId: `pf-${code}`,
    portfolioCode: code,
    portfolioName: `${code} name`,
    quantity,
    held: {},
  })
  const contract = {
    ...holdingContract,
    positions: {
      shared: {
        ...makePosition({ asset: makeAsset({ id: "a1", code: "AAA" }) }),
        moneyValues: { PORTFOLIO: { marketValue: 1000 } },
        quantityValues: { total: 4 },
        portfolioBreakdown: [breakdown("GROWTH", 3), breakdown("YIELD", 1)],
      },
    },
  }

  beforeEach(() => {
    ;(useSwr as unknown as jest.Mock).mockImplementation((key: unknown) => ({
      data:
        typeof key === "string" && key.startsWith("/api/holdings/aggregated")
          ? { data: contract }
          : undefined,
      error: undefined,
      isLoading: false,
      mutate: jest.fn(),
    }))
  })

  afterEach(() => {
    delete mockRouterQuery.codes
    jest.clearAllMocks()
  })

  it("lists each portfolio with its weight and links to its holdings", () => {
    mockRouterQuery.codes = "GROWTH,YIELD"
    render(<AggregatedHoldingsPage />)

    expect(
      screen.queryByRole("link", { name: /GROWTH/ }),
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "2 portfolios" }))

    const growth = screen.getByRole("link", { name: /GROWTH/ })
    expect(growth).toHaveAttribute("href", "/holdings/GROWTH")
    expect(growth).toHaveTextContent("75.0%")
    expect(screen.getByRole("link", { name: /YIELD/ })).toHaveTextContent(
      "25.0%",
    )
  })

  it("offers the same list when viewing all portfolios", () => {
    render(<AggregatedHoldingsPage />)

    fireEvent.click(screen.getByRole("button", { name: "all portfolios" }))

    expect(screen.getByRole("link", { name: /GROWTH/ })).toBeInTheDocument()
  })

  it("says so when the view holds no portfolios", () => {
    ;(useSwr as unknown as jest.Mock).mockImplementation((key: unknown) => ({
      data:
        typeof key === "string" && key.startsWith("/api/holdings/aggregated")
          ? { data: { ...holdingContract, positions: {} } }
          : undefined,
      error: undefined,
      isLoading: false,
      mutate: jest.fn(),
    }))
    render(<AggregatedHoldingsPage />)

    fireEvent.click(screen.getByRole("button", { name: "all portfolios" }))

    expect(screen.getByText("No portfolios in this view")).toBeInTheDocument()
  })

  it("names a single portfolio without a list to open", () => {
    mockRouterQuery.codes = "GROWTH"
    render(<AggregatedHoldingsPage />)

    expect(screen.getByText("Showing holdings for GROWTH")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /portfolios$/ }),
    ).not.toBeInTheDocument()
  })
})
