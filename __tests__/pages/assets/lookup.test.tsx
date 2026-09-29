import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import useSWR from "swr"
import AssetLookupPage from "@pages/assets/lookup"
import { marketsKey } from "@utils/api/fetchHelper"
import { formatDate } from "@lib/formatters"
import {
  makeAsset,
  makePortfolio,
  makePosition,
} from "@test-fixtures/beancounter"

// Mock next/router — hydrate selectedAsset straight from the query string so
// tests don't have to drive AssetSearch's own fetch/debounce flow.
const defaultQuery: Record<string, string> = {
  assetId: "asset-1",
  symbol: "AAPL",
  market: "NASDAQ",
  name: "Apple Inc",
  currency: "USD",
  type: "EQUITY",
}
let mockQuery: Record<string, string> = defaultQuery
jest.mock("next/router", () => ({
  useRouter: () => ({
    isReady: true,
    query: mockQuery,
    push: jest.fn(),
  }),
}))

let capturedSectorProps: Record<string, unknown> | null = null
jest.mock("@components/features/holdings/SectorWeightingsPopup", () => {
  return function SectorWeightingsPopup(props: Record<string, unknown>) {
    capturedSectorProps = props
    return props.modalOpen ? <div data-testid="sector-popup" /> : null
  }
})

jest.mock("@contexts/UserPreferencesContext", () => ({
  useUserPreferences: () => ({ preferences: {}, isLoading: false }),
}))

let capturedTradeProps: Record<string, unknown> | null = null
jest.mock("@components/features/transactions/TradeInputForm", () => {
  return function TradeInputForm(props: Record<string, unknown>) {
    capturedTradeProps = props
    return props.modalOpen ? (
      <div data-testid="trade-modal">{JSON.stringify(props.initialValues)}</div>
    ) : null
  }
})

jest.mock("@components/features/transactions/TradeAssetAction", () => {
  return function TradeAssetAction() {
    return <div data-testid="trade-asset-action" />
  }
})

let capturedBrokersTabProps: Record<string, unknown> | null = null
jest.mock("@components/features/assets/AssetBrokersTab", () => {
  return function AssetBrokersTab(props: Record<string, unknown>) {
    capturedBrokersTabProps = props
    return <div data-testid="brokers-tab-content">{"Brokers Tab"}</div>
  }
})

jest.mock("swr", () => ({
  __esModule: true,
  default: jest.fn(),
  mutate: jest.fn(),
}))

const positionsKey = "/api/assets/asset-1/positions?date=today"
const modelsKeyUrl = "/api/rebalance/assets/asset-1/models"
const permissionsKey = "/api/auth/permissions"
const priceKey = "/api/prices/asset-1"
const defaultPrice = {
  data: [
    {
      close: 181.42,
      change: -2.1,
      changePercent: -0.0114,
      previousClose: 183.52,
      priceDate: "2026-09-29",
    },
  ],
}
let priceFixture: unknown = defaultPrice

const growthPortfolio = makePortfolio({ id: "pf-1", code: "GROWTH" })
const incomePortfolio = makePortfolio({ id: "pf-2", code: "INCOME" })

const positionsFixture = [
  {
    portfolio: growthPortfolio,
    position: makePosition({
      asset: makeAsset({ id: "asset-1", code: "AAPL" }),
      quantityValues: { total: 100, purchased: 100 },
      price: 150,
    }),
    balance: 100,
  },
  {
    // Fully sold out — must be hidden from the Portfolios tab.
    portfolio: incomePortfolio,
    position: makePosition({
      asset: makeAsset({ id: "asset-1", code: "AAPL" }),
      quantityValues: { total: 0, purchased: 100 },
      price: 150,
    }),
    balance: 0,
  },
]

const modelsFixture = [
  {
    modelId: "model-1",
    planId: "plan-1",
    modelName: "Growth Model",
    assetCode: "AAPL",
    planVersion: 2,
    targetWeight: 0.1,
  },
]

function mockSwrData(): void {
  ;(useSWR as unknown as jest.Mock).mockImplementation((key: unknown) => {
    if (key === marketsKey) {
      return { data: { data: [] }, isLoading: false }
    }
    if (key === positionsKey) {
      return { data: { data: positionsFixture }, isLoading: false }
    }
    if (key === modelsKeyUrl) {
      return { data: { data: modelsFixture }, isLoading: false }
    }
    if (key === permissionsKey) {
      return { data: undefined, isLoading: false }
    }
    if (key === priceKey) {
      return { data: priceFixture, isLoading: false }
    }
    return { data: undefined, isLoading: false }
  })
}

describe("Asset Lookup Page — tabbed layout", () => {
  beforeEach(() => {
    mockQuery = defaultQuery
    capturedTradeProps = null
    capturedBrokersTabProps = null
    mockSwrData()
  })

  it("defaults to the Portfolios tab and hides zero-balance rows", () => {
    render(<AssetLookupPage />)

    expect(screen.getByText("GROWTH")).toBeInTheDocument()
    expect(screen.queryByText("INCOME")).not.toBeInTheDocument()
  })

  it("switches to the Brokers tab and renders AssetBrokersTab with the asset id", () => {
    render(<AssetLookupPage />)

    fireEvent.click(screen.getByRole("button", { name: /brokers/i }))

    expect(screen.getByTestId("brokers-tab-content")).toBeInTheDocument()
    expect(capturedBrokersTabProps).toEqual({ assetId: "asset-1" })
    expect(screen.queryByText("GROWTH")).not.toBeInTheDocument()
  })

  it("switches to the Models tab and renders model rows", () => {
    render(<AssetLookupPage />)

    fireEvent.click(screen.getByRole("button", { name: /models/i }))

    expect(screen.getByText("Growth Model")).toBeInTheDocument()
    expect(screen.getByText("v2")).toBeInTheDocument()
    expect(screen.queryByText("GROWTH")).not.toBeInTheDocument()
  })

  it("opens the trade form prefilled as a SELL with the row's quantity when Sell is clicked", () => {
    render(<AssetLookupPage />)

    const sellButton = screen.getByTitle(/sell aapl from growth/i)
    fireEvent.click(sellButton)

    expect(screen.getByTestId("trade-modal")).toBeInTheDocument()
    expect(capturedTradeProps?.portfolio).toEqual(growthPortfolio)
    expect(capturedTradeProps?.initialValues).toMatchObject({
      type: "SELL",
      quantity: 100,
      market: "NASDAQ",
      price: 150,
    })
  })

  it("does not render a Sell action for the Composite pseudo-row", () => {
    ;(useSWR as unknown as jest.Mock).mockImplementation((key: unknown) => {
      if (key === marketsKey) return { data: { data: [] }, isLoading: false }
      if (key === positionsKey) {
        return {
          data: {
            data: [
              {
                portfolio: null,
                position: makePosition({
                  asset: makeAsset({ id: "asset-1", code: "AAPL" }),
                }),
                balance: 250,
              },
            ],
          },
          isLoading: false,
        }
      }
      if (key === modelsKeyUrl) {
        return { data: { data: [] }, isLoading: false }
      }
      return { data: undefined, isLoading: false }
    })

    render(<AssetLookupPage />)

    expect(screen.getByText("Composite")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /^sell/i }),
    ).not.toBeInTheDocument()
  })
})

describe("Asset Lookup Page — ETF sectors", () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    mockQuery = defaultQuery
    capturedSectorProps = null
    mockSwrData()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it("does not offer Sectors for an equity", () => {
    render(<AssetLookupPage />)

    expect(
      screen.queryByRole("button", { name: /sectors/i }),
    ).not.toBeInTheDocument()
  })

  it("opens the sector weightings for a known ETF", async () => {
    mockQuery = {
      ...defaultQuery,
      symbol: "VOO",
      name: "Vanguard S&P 500",
      type: "ETF",
    }
    render(<AssetLookupPage />)

    fireEvent.click(screen.getByRole("button", { name: /sectors/i }))

    expect(await screen.findByTestId("sector-popup")).toBeInTheDocument()
    expect((capturedSectorProps?.asset as { id: string }).id).toBe("asset-1")
  })

  it("offers Sectors for a search hit typed as a mutual fund", () => {
    mockQuery = { ...defaultQuery, symbol: "SPY", type: "Mutual Fund" }
    render(<AssetLookupPage />)

    expect(screen.getByRole("button", { name: /sectors/i })).toBeInTheDocument()
  })

  it("resolves an ETF not yet known to BC before showing its sectors", async () => {
    mockQuery = {
      symbol: "VTI",
      market: "US",
      name: "Vanguard Total Market",
      currency: "USD",
      type: "ETF",
    }
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: { VTI: makeAsset({ id: "vti-id", code: "VTI" }) },
        }),
    }) as unknown as typeof fetch
    render(<AssetLookupPage />)

    fireEvent.click(screen.getByRole("button", { name: /sectors/i }))

    expect(await screen.findByTestId("sector-popup")).toBeInTheDocument()
    expect((capturedSectorProps?.asset as { id: string }).id).toBe("vti-id")
  })
})

describe("Asset Lookup Page — last close", () => {
  beforeEach(() => {
    mockQuery = defaultQuery
    priceFixture = defaultPrice
    mockSwrData()
  })

  it("shows the provider's latest close, change and price date", () => {
    render(<AssetLookupPage />)

    const lastClose = screen.getByTestId("last-close")
    expect(lastClose).toHaveTextContent("Last Close")
    expect(lastClose).toHaveTextContent("181.42")
    expect(lastClose).toHaveTextContent("-2.10")
    expect(lastClose).toHaveTextContent("-1.14%")
    expect(lastClose).toHaveTextContent(formatDate("2026-09-29"))
  })

  it("omits the change when the provider sent no previous close", () => {
    priceFixture = {
      data: [
        {
          close: 227.21,
          change: 0,
          changePercent: 0,
          previousClose: 0,
          priceDate: "2026-09-29",
        },
      ],
    }
    render(<AssetLookupPage />)

    const lastClose = screen.getByTestId("last-close")
    expect(lastClose).toHaveTextContent("227.21")
    expect(lastClose).not.toHaveTextContent("0.00%")
  })

  it("hides last close when the provider returns no price", () => {
    priceFixture = { data: [] }
    render(<AssetLookupPage />)

    expect(screen.queryByTestId("last-close")).not.toBeInTheDocument()
  })
})
