import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import useSWR from "swr"
import AssetLookupPage from "@pages/assets/lookup"
import { marketsKey } from "@utils/api/fetchHelper"
import {
  makeAsset,
  makePortfolio,
  makePosition,
} from "@test-fixtures/beancounter"

// Mock next/router — hydrate selectedAsset straight from the query string so
// tests don't have to drive AssetSearch's own fetch/debounce flow.
jest.mock("next/router", () => ({
  useRouter: () => ({
    isReady: true,
    query: {
      assetId: "asset-1",
      symbol: "AAPL",
      market: "NASDAQ",
      name: "Apple Inc",
      currency: "USD",
      type: "EQUITY",
    },
    push: jest.fn(),
  }),
}))

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
    return { data: undefined, isLoading: false }
  })
}

describe("Asset Lookup Page — tabbed layout", () => {
  beforeEach(() => {
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
