import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import useSWR from "swr"
import Trades from "@pages/trns/trades/[...trades]"
import CashLadder from "@pages/trns/cash-ladder/[...params]"

// A trade's cash opens the cash ladder it settled to, and a ladder row opens the
// trade behind it. Either way the page lands with that transaction flashed.

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  query: {} as Record<string, unknown>,
  isReady: true,
}

jest.mock("next/router", () => ({ useRouter: () => mockRouter }))

jest.mock("swr", () => ({
  __esModule: true,
  default: jest.fn(),
  mutate: jest.fn(),
}))

jest.mock("@auth0/nextjs-auth0/client", () => ({
  withPageAuthRequired: (Component: React.ComponentType) => Component,
}))

jest.mock("@components/features/transactions/FxEditModal", () => ({
  __esModule: true,
  default: () => null,
}))
jest.mock("@components/features/transactions/SubAccountTrnEditModal", () => ({
  __esModule: true,
  default: () => null,
}))
jest.mock("@components/features/transactions/TradeInputForm", () => ({
  __esModule: true,
  default: () => null,
}))

const asset = {
  id: "a1",
  code: "AAPL",
  displayCode: "AAPL",
  name: "Apple Inc",
  market: { code: "NASDAQ" },
  assetCategory: { id: "EQUITY", name: "Equity" },
}
const cashAsset = {
  id: "cash-usd",
  code: "USD",
  displayCode: "USD",
  name: "US Dollar",
  market: { code: "CASH" },
  assetCategory: { id: "CASH", name: "Cash" },
  priceSymbol: "USD",
}

const makeTrn = (overrides: Record<string, unknown>): object => ({
  id: "t1",
  trnType: "BUY",
  status: "SETTLED",
  tradeDate: "2026-02-03",
  quantity: 2,
  price: 100,
  tradeAmount: 200,
  cashAmount: -200,
  tax: 0,
  fees: 0,
  tradeCurrency: { code: "USD" },
  portfolio: { id: "p1", code: "PF1" },
  asset,
  ...overrides,
})

const stubSwr = (data: Record<string, unknown>): void => {
  ;(useSWR as unknown as jest.Mock).mockImplementation((key: string | null) => {
    const hit = key && Object.keys(data).find((k) => key.includes(k))
    return {
      data: hit ? data[hit] : undefined,
      error: undefined,
      isLoading: false,
      mutate: jest.fn(),
    }
  })
}

const tradesView = (trns: object[]): void => {
  mockRouter.query = { trades: ["p1", "a1"] }
  stubSwr({ "/trns/": { data: trns }, "/assets/": { data: asset } })
}
const ladderView = (trns: object[]): void => {
  mockRouter.query = { params: ["p1", "cash-usd"] }
  stubSwr({
    "cash-ladder": { data: trns },
    "/assets/": { data: cashAsset },
    "/portfolios/": { data: { id: "p1", code: "PF1" } },
  })
}

const mockFetch = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  window.location.hash = ""
  global.fetch = mockFetch
  Element.prototype.scrollIntoView = jest.fn()
})

describe("trade list: cash opens the cash ladder", () => {
  it("links a trade's cash to its cash ladder with the trade flashed", () => {
    tradesView([makeTrn({ cashAsset })])
    render(<Trades />)

    const links = screen.getAllByRole("link", { name: /-200\.00/ })
    expect(links.length).toBeGreaterThan(0)
    links.forEach((link) =>
      expect(link).toHaveAttribute(
        "href",
        "/trns/cash-ladder/p1/cash-usd#trn-t1",
      ),
    )
  })

  it("gives no link to cash with no settlement account", () => {
    tradesView([makeTrn({})])
    render(<Trades />)

    expect(
      screen.queryByRole("link", { name: /-200\.00/ }),
    ).not.toBeInTheDocument()
  })

  it("flashes the transaction the link points at", async () => {
    window.location.hash = "#trn-t2"
    tradesView([makeTrn({ cashAsset }), makeTrn({ id: "t2", cashAsset })])
    render(<Trades />)

    await waitFor(() =>
      expect(
        document.querySelector('[data-trn-id="t2"].asset-target'),
      ).not.toBeNull(),
    )
    expect(document.querySelector('[data-trn-id="t1"].asset-target')).toBeNull()
  })
})

describe("cash ladder: a row opens the trade behind it", () => {
  it("links a trade's description to the asset's trades with it flashed", () => {
    ladderView([makeTrn({ id: "t2", comments: "Buy 2 Apple" })])
    render(<CashLadder />)

    const links = screen.getAllByRole("link", { name: "Buy 2 Apple" })
    links.forEach((link) =>
      expect(link).toHaveAttribute("href", "/trns/trades/p1/a1#trn-t2"),
    )
  })

  it("gives a plain deposit no link", () => {
    ladderView([
      makeTrn({ trnType: "DEPOSIT", asset: cashAsset, comments: "Top up" }),
    ])
    render(<CashLadder />)

    expect(
      screen.queryByRole("link", { name: "Top up" }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Top up" }),
    ).not.toBeInTheDocument()
  })

  it("opens the trade an auto-settle leg settles", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [
            makeTrn({ id: "parent", portfolio: { id: "p9", code: "PF9" } }),
          ],
        }),
    })
    ladderView([
      makeTrn({
        id: "leg",
        trnType: "WITHDRAWAL",
        asset: cashAsset,
        comments: "Auto-settle",
        callerRef: { provider: "BC-AUTO", batch: "x", callerId: "y" },
      }),
    ])
    render(<CashLadder />)

    fireEvent.click(screen.getAllByRole("button", { name: "Auto-settle" })[0])

    await waitFor(() =>
      expect(mockRouter.push).toHaveBeenCalledWith(
        "/trns/trades/p9/a1#trn-parent",
      ),
    )
    expect(mockFetch.mock.calls[0][0]).toContain("/trns/settles/leg")
  })
})
