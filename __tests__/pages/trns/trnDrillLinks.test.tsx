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
    "/portfolios/fund": { data: { id: "fund", code: "FUND" } },
    "/portfolios/": {
      data: { id: "p1", code: "PF1", cashPortfolioId: "fund" },
    },
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
    ladderView([makeTrn({ id: "t2", comments: "CB" })])
    render(<CashLadder />)

    const links = screen.getAllByRole("link", { name: "Buy 2 Apple Inc · CB" })
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

describe("cash ladder: an auto-settle leg folds into its trade", () => {
  const pair = (): object[] => [
    makeTrn({
      id: "leg",
      trnType: "DEPOSIT",
      asset: cashAsset,
      cashAmount: 200,
      quantity: 200,
      comments: "Auto-settle for BUY AAPL",
      callerRef: { provider: "BC-AUTO", batch: "c1", callerId: "leg-c" },
    }),
    makeTrn({
      id: "t1",
      comments: "CB",
      callerRef: { provider: "BC", batch: "b", callerId: "c1" },
    }),
  ]
  const rows = (): (string | null)[] =>
    Array.from(document.querySelectorAll("tbody tr")).map((row) =>
      row.getAttribute("data-trn-id"),
    )
  const expand = (): void => {
    fireEvent.click(
      screen.getAllByRole("button", { name: "Show both entries" })[0],
    )
  }

  it("shows the pair as one row carrying the trade's description", () => {
    ladderView(pair())
    render(<CashLadder />)

    expect(rows()).toEqual(["leg"])
    expect(
      screen.getAllByRole("link", { name: "Buy 2 Apple Inc · CB" }).length,
    ).toBeGreaterThan(0)
    expect(screen.getAllByText("· from FUND").length).toBeGreaterThan(0)
  })

  it("shows the cash the trade moved, unsigned, as it passes straight through", () => {
    ladderView(pair())
    render(<CashLadder />)

    const row = document.querySelector('tr[data-trn-id="leg"]')!
    expect(row).toHaveTextContent("200.00")
    expect(row).not.toHaveTextContent("+0.00")
    expect(row).not.toHaveTextContent("-200.00")
  })

  it("opens into both entries, bracketed, and closes again", () => {
    ladderView(pair())
    render(<CashLadder />)

    expand()

    expect(rows()).toEqual(["leg", "t1"])
    const row = (id: string): Element =>
      document.querySelector(`tr[data-trn-id="${id}"]`)!
    expect(row("leg").querySelector('[data-pair-edge="top"]')).not.toBeNull()
    expect(row("t1").querySelector('[data-pair-edge="bottom"]')).not.toBeNull()
    expect(
      screen.getAllByRole("button", { name: "Settles this BUY · from FUND" })
        .length,
    ).toBeGreaterThan(0)

    fireEvent.click(
      screen.getAllByRole("button", { name: "Hide the entries" })[0],
    )
    expect(rows()).toEqual(["leg"])
  })

  it("tints both entries while either is hovered", () => {
    ladderView(pair())
    render(<CashLadder />)
    expand()

    const row = (id: string): Element =>
      document.querySelector(`tr[data-trn-id="${id}"]`)!
    fireEvent.mouseEnter(row("leg"))

    expect(row("leg")).toHaveClass("bg-blue-50")
    expect(row("t1")).toHaveClass("bg-blue-50")

    fireEvent.mouseLeave(row("leg"))
    expect(row("t1")).not.toHaveClass("bg-blue-50")
  })

  it("flashes the folded row when a link points at the trade inside it", async () => {
    window.location.hash = "#trn-t1"
    ladderView(pair())
    render(<CashLadder />)

    await waitFor(() =>
      expect(
        document.querySelector('tr[data-trn-id="leg"].asset-target'),
      ).not.toBeNull(),
    )
  })
})

describe("cash ladder: legs posted together still sit with their trades", () => {
  it("folds each leg into its own trade", () => {
    const legOf = (id: string, callerId: string): object =>
      makeTrn({
        id,
        trnType: "DEPOSIT",
        asset: cashAsset,
        callerRef: {
          provider: "BC-AUTO",
          batch: callerId,
          callerId: `${id}-c`,
        },
      })
    const tradeOf = (id: string, callerId: string, comments: string): object =>
      makeTrn({
        id,
        comments,
        callerRef: { provider: "BC", batch: "b", callerId },
      })
    ladderView([
      legOf("l2", "c2"),
      legOf("l1", "c1"),
      tradeOf("t2", "c2", "second"),
      tradeOf("t1", "c1", "first"),
    ])
    render(<CashLadder />)

    const order = Array.from(document.querySelectorAll("tr[data-trn-id]")).map(
      (row) => row.getAttribute("data-trn-id"),
    )
    expect(order).toEqual(["l2", "l1"])
    const described = (id: string): string | null =>
      document.querySelector(`tr[data-trn-id="${id}"]`)!.textContent
    expect(described("l2")).toContain("second")
    expect(described("l1")).toContain("first")
  })
})
