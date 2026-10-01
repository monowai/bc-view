import React from "react"
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react"
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

let mockPermissions = { ai: false, preview: false, admin: false }
jest.mock("@hooks/usePermissions", () => ({
  usePermissions: () => ({ ...mockPermissions, isLoading: false }),
}))

let capturedNewsProps: Record<string, unknown> | null = null
jest.mock("@components/features/assets/AssetNewsPopup", () => {
  return function AssetNewsPopup(props: Record<string, unknown>) {
    capturedNewsProps = props
    return <div data-testid="news-popup" />
  }
})

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

// Stub the search box so tests can pick hits directly, without driving
// AssetSearch's own fetch/debounce flow.
let capturedSearchProps: Record<string, unknown> | null = null
jest.mock("@components/features/assets/AssetSearch", () => {
  return function AssetSearch(props: Record<string, unknown>) {
    capturedSearchProps = props
    return <div data-testid="asset-search" />
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
const priceKey = "/api/prices/asset-1/quote"
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

    const sectors = screen.getByRole("button", { name: /sectors/i })
    await waitFor(() => expect(sectors).toBeEnabled())
    fireEvent.click(sectors)

    expect(await screen.findByTestId("sector-popup")).toBeInTheDocument()
    expect((capturedSectorProps?.asset as { id: string }).id).toBe("vti-id")
    expect(global.fetch).toHaveBeenCalledTimes(1)
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

  it("creates a search hit BC doesn't know yet, then shows its quote", async () => {
    mockQuery = {
      symbol: "PLTR",
      market: "US",
      name: "Palantir",
      currency: "USD",
      type: "Common Stock",
    }
    const originalFetch = global.fetch
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: { PLTR: makeAsset({ id: "pltr-id", code: "PLTR" }) },
        }),
    })
    global.fetch = fetchMock as unknown as typeof fetch
    const swr = useSWR as unknown as jest.Mock
    const base = swr.getMockImplementation()!
    swr.mockImplementation((key: unknown) =>
      key === "/api/prices/pltr-id/quote"
        ? { data: defaultPrice, isLoading: false }
        : base(key),
    )
    try {
      render(<AssetLookupPage />)

      expect(await screen.findByTestId("last-close")).toHaveTextContent(
        "181.42",
      )
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/assets",
        expect.objectContaining({ method: "POST" }),
      )
    } finally {
      global.fetch = originalFetch
    }
  })

  it("creates the newly picked hit when it shares a symbol with a pending one", async () => {
    const originalFetch = global.fetch
    const created = (
      id: string,
    ): { ok: boolean; json: () => Promise<unknown> } => ({
      ok: true,
      json: () =>
        Promise.resolve({ data: { VOO: makeAsset({ id, code: "VOO" }) } }),
    })
    // First create hangs, so the second pick lands while it is in flight.
    const fetchMock = jest
      .fn()
      .mockReturnValueOnce(new Promise(() => {}))
      .mockResolvedValueOnce(created("voo-lse"))
    global.fetch = fetchMock as unknown as typeof fetch
    const onSelect = (option: Record<string, string>): void =>
      (capturedSearchProps?.onSelect as (o: unknown) => void)(option)
    const hit = (market: string): Record<string, string> => ({
      value: "VOO",
      label: `VOO - Vanguard S&P 500 (${market})`,
      symbol: "VOO",
      name: "Vanguard S&P 500",
      market,
      currency: "USD",
      type: "ETF",
    })
    try {
      render(<AssetLookupPage />)
      act(() => onSelect(hit("US")))
      act(() => onSelect(hit("LSE")))

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
      const body = JSON.parse(fetchMock.mock.calls[1][1].body)
      expect(body.data.VOO.market).toBe("LSE")
    } finally {
      global.fetch = originalFetch
    }
  })

  it("holds the Chart button while a picked hit is still being created", async () => {
    mockQuery = {
      symbol: "PLTR",
      market: "US",
      name: "Palantir",
      currency: "USD",
      type: "Common Stock",
    }
    const originalFetch = global.fetch
    let finish: (value: unknown) => void = () => {}
    const fetchMock = jest.fn().mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    global.fetch = fetchMock as unknown as typeof fetch
    try {
      render(<AssetLookupPage />)
      const chart = screen.getByRole("button", {
        name: /price chart for PLTR/i,
      })
      expect(chart).toBeDisabled()

      act(() => {
        finish({
          ok: true,
          json: () =>
            Promise.resolve({
              data: { PLTR: makeAsset({ id: "pltr-id", code: "PLTR" }) },
            }),
        })
      })

      await waitFor(() => expect(chart).toBeEnabled())
      expect(fetchMock).toHaveBeenCalledTimes(1)
    } finally {
      global.fetch = originalFetch
    }
  })

  it("hides last close when the provider returns no price", () => {
    priceFixture = { data: [] }
    render(<AssetLookupPage />)

    expect(screen.queryByTestId("last-close")).not.toBeInTheDocument()
  })
})

describe("Asset Lookup Page — news", () => {
  beforeEach(() => {
    mockQuery = defaultQuery
    capturedNewsProps = null
    mockSwrData()
  })

  it("opens the news popup for the selected search result", () => {
    render(<AssetLookupPage />)

    expect(screen.queryByTestId("news-popup")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /news for AAPL/i }))

    expect(screen.getByTestId("news-popup")).toBeInTheDocument()
    expect(capturedNewsProps).toMatchObject({
      symbol: "AAPL",
      market: "NASDAQ",
      name: "Apple Inc",
    })
  })

  it("closes the news popup", () => {
    render(<AssetLookupPage />)
    fireEvent.click(screen.getByRole("button", { name: /news for AAPL/i }))

    act(() => (capturedNewsProps?.onClose as () => void)())

    expect(screen.queryByTestId("news-popup")).not.toBeInTheDocument()
  })
})

describe("Asset Lookup Page — quiet by default", () => {
  beforeEach(() => {
    mockQuery = defaultQuery
    mockPermissions = { ai: false, preview: false, admin: false }
    mockSwrData()
    ;(useSWR as unknown as jest.Mock).mockClear()
  })

  const requestedKeys = (): unknown[] =>
    (useSWR as unknown as jest.Mock).mock.calls.map((call) => call[0])

  it("does not ask the rebalance service for models until the Models tab is opened", () => {
    render(<AssetLookupPage />)

    expect(requestedKeys()).not.toContain(modelsKeyUrl)

    fireEvent.click(screen.getByRole("button", { name: /models/i }))

    expect(requestedKeys()).toContain(modelsKeyUrl)
  })

  it("offers no overflow menu to a non-admin", () => {
    render(<AssetLookupPage />)

    expect(
      screen.queryByRole("button", { name: /more actions/i }),
    ).not.toBeInTheDocument()
  })

  it("keeps admin Edit and Delete behind the overflow menu", () => {
    mockPermissions = { ai: false, preview: false, admin: true }
    render(<AssetLookupPage />)

    expect(
      screen.queryByRole("button", { name: /delete asset/i }),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /more actions/i }))

    expect(screen.getByRole("menuitem", { name: /edit/i })).toBeEnabled()
    // AAPL is held in GROWTH, so it cannot be deleted.
    expect(screen.getByRole("menuitem", { name: /delete/i })).toBeDisabled()
  })

  it("shows why the backend refused a delete", async () => {
    mockPermissions = { ai: false, preview: false, admin: true }
    ;(useSWR as unknown as jest.Mock).mockImplementation((key: unknown) =>
      key === positionsKey
        ? { data: { data: [] }, isLoading: false }
        : { data: undefined, isLoading: false },
    )
    const originalFetch = global.fetch
    const originalConfirm = window.confirm
    window.confirm = jest.fn(() => true)
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 409,
      statusText: "Conflict",
      text: () => Promise.resolve(JSON.stringify({ message: "Asset in use" })),
    }) as unknown as typeof fetch
    try {
      render(<AssetLookupPage />)
      fireEvent.click(screen.getByRole("button", { name: /more actions/i }))
      fireEvent.click(screen.getByRole("menuitem", { name: /delete/i }))

      expect(await screen.findByText("Asset in use")).toBeInTheDocument()
      expect(global.fetch).toHaveBeenCalledWith("/api/assets/admin/asset-1", {
        method: "DELETE",
      })
    } finally {
      global.fetch = originalFetch
      window.confirm = originalConfirm
    }
  })
})
