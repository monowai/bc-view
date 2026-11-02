import React from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import useSWR, { mutate as globalMutate } from "swr"
import { deleteTrn } from "@utils/api/client/trns"
import PortfolioTrades from "@pages/portfolios/trades/[...trades]"
import Trades from "@pages/trns/trades/[...trades]"
import Events from "@pages/trns/events/[...events]"
import CashLadder from "@pages/trns/cash-ladder/[...params]"

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

jest.mock("@utils/api/client/trns", () => ({
  ...jest.requireActual("@utils/api/client/trns"),
  deleteTrn: jest.fn(),
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

const swrMutate = jest.fn()

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
  quantity: 1234.5678,
  price: 12.3456,
  tradeAmount: 15241.3857,
  cashAmount: -15241.3857,
  tradeBaseRate: 1.23456,
  tradeCashRate: 0.98765,
  tradePortfolioRate: 1.11119,
  tax: 1.5,
  fees: 2.255,
  comments: "a note",
  tradeCurrency: { code: "USD" },
  portfolio: { id: "p1", code: "PF1" },
  asset,
  ...overrides,
})

const trades = [
  makeTrn({ broker: { id: "b1", name: "Saxo" } }),
  makeTrn({
    id: "t2",
    trnType: "INCOME",
    status: "PROPOSED",
    comments: undefined,
    fees: 0,
    tax: 0,
    cashAsset,
  }),
  makeTrn({
    id: "t3",
    trnType: "COST_ADJUST",
    status: "OTHER",
    cashAsset: { ...asset, name: "" },
  }),
  makeTrn({ id: "t4", trnType: "EXPENSE", cashCurrency: { code: "EUR" } }),
]

const events = [
  makeTrn({ trnType: "DIVI", quantity: 1000.6, cashAsset }),
  makeTrn({
    id: "t2",
    trnType: "SPLIT",
    status: "PROPOSED",
    cashAsset: { ...asset, name: "" },
  }),
  makeTrn({ id: "t3", trnType: "DIVI", cashCurrency: { code: "EUR" } }),
]

const ladder = [
  makeTrn({
    trnType: "DEPOSIT",
    asset: cashAsset,
    quantity: 1000.125,
    price: 1,
    comments: undefined,
  }),
  makeTrn({ id: "t2", trnType: "BUY", cashAmount: -250.5, price: 0 }),
  makeTrn({
    id: "t3",
    trnType: "INCOME",
    asset: cashAsset,
    tradeAmount: 75.25,
    status: "PROPOSED",
  }),
  makeTrn({
    id: "t4",
    trnType: "EXPENSE",
    asset: cashAsset,
    cashAmount: -9,
    status: "OTHER",
  }),
]

const stubSwr = (data: Record<string, unknown>): void => {
  ;(useSWR as unknown as jest.Mock).mockImplementation((key: string | null) => {
    const hit = key && Object.keys(data).find((k) => key.includes(k))
    return {
      data: hit ? data[hit] : undefined,
      error: undefined,
      isLoading: false,
      mutate: swrMutate,
    }
  })
}

const assetResponse = { data: asset }

const portfolioTradesView = (trns: object[]): void => {
  mockRouter.query = { trades: ["p1", "a1"] }
  stubSwr({ "/trns/": { data: trns }, "/assets/": assetResponse })
}
const tradesView = (trns: object[], query: object = {}): void => {
  mockRouter.query = { trades: ["p1", "a1"], ...query }
  stubSwr({ "/trns/": { data: trns }, "/assets/": assetResponse })
}
const eventsView = (trns: object[]): void => {
  mockRouter.query = { events: ["p1", "a1"] }
  stubSwr({ "/trns/": { data: trns }, "/assets/": assetResponse })
}
const ladderView = (trns: object[]): void => {
  mockRouter.query = { params: ["p1", "cash-usd"] }
  stubSwr({
    "cash-ladder": { data: trns },
    "/assets/": { data: cashAsset },
    "/portfolios/": { data: { id: "p1", code: "PF1" } },
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  Object.assign(navigator, { clipboard: { writeText: jest.fn() } })
  ;(deleteTrn as jest.Mock).mockResolvedValue({ ok: true })
})

// Each page's rendered DOM is pinned: classes, text and every number's scale.
describe("transaction list pages DOM", () => {
  it("renders the portfolio trades table", () => {
    portfolioTradesView(trades)
    const { container } = render(<PortfolioTrades />)
    expect(container.innerHTML).toMatchSnapshot()
  })

  it("renders the trades list grouped by broker", () => {
    tradesView(trades)
    const { container } = render(<Trades />)
    expect(container.innerHTML).toMatchSnapshot()
  })

  it("renders the aggregated trades list without tabs", () => {
    tradesView(trades, { trades: ["a1"], portfolios: "p1,p2" })
    const { container } = render(<Trades />)
    expect(container.innerHTML).toMatchSnapshot()
  })

  it("renders the trades empty state", () => {
    tradesView([])
    const { container } = render(<Trades />)
    expect(container.innerHTML).toMatchSnapshot()
  })

  it("renders the events list", () => {
    eventsView(events)
    const { container } = render(<Events />)
    expect(container.innerHTML).toMatchSnapshot()
  })

  it("renders the events empty state", () => {
    eventsView([])
    const { container } = render(<Events />)
    expect(container.innerHTML).toMatchSnapshot()
  })

  it("renders the cash ladder", () => {
    ladderView(ladder)
    const { container } = render(<CashLadder />)
    expect(container.innerHTML).toMatchSnapshot()
  })

  it("renders the cash ladder empty state", () => {
    ladderView([])
    const { container } = render(<CashLadder />)
    expect(container.innerHTML).toMatchSnapshot()
  })
})

describe("transaction list scales", () => {
  it("shows a portfolio trade amount at zero decimals and rates at four", () => {
    portfolioTradesView([makeTrn({})])
    render(<PortfolioTrades />)
    expect(screen.getByText("15,241")).toBeInTheDocument()
    expect(screen.getByText("1.2346")).toBeInTheDocument()
    expect(screen.getByText("1,234.57")).toBeInTheDocument()
  })

  it("rounds event quantity to whole units", () => {
    eventsView([makeTrn({ quantity: 1000.6 })])
    render(<Events />)
    expect(screen.getAllByText("1,001")).toHaveLength(2)
  })

  it("signs cash ladder credits", () => {
    ladderView(ladder.slice(0, 1))
    render(<CashLadder />)
    expect(screen.getAllByText("+1,000.13")).toHaveLength(2)
  })
})

describe("transaction list row actions", () => {
  const pages: [string, () => void, React.ComponentType][] = [
    ["trades", (): void => tradesView(trades), Trades],
    ["events", (): void => eventsView(events), Events],
    ["cash ladder", (): void => ladderView(ladder), CashLadder],
  ]

  it.each(pages)("edits from the %s row once", (_name, view, Page) => {
    view()
    render(<Page />)
    fireEvent.click(screen.getAllByTitle("Edit")[0])
    expect(mockRouter.push).toHaveBeenCalledTimes(1)
    expect(mockRouter.push).toHaveBeenCalledWith("/trns/trades/edit/p1/t1")
  })

  it.each(pages)("edits a %s row on double click", (_name, view, Page) => {
    view()
    render(<Page />)
    fireEvent.doubleClick(screen.getAllByTitle("Double-click to edit")[0])
    expect(mockRouter.push).toHaveBeenCalledWith("/trns/trades/edit/p1/t1")
  })

  it.each(pages)("copies a %s row", (_name, view, Page) => {
    view()
    render(<Page />)
    fireEvent.click(screen.getAllByTitle("Copy")[0])
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1)
  })

  it.each(pages)("deletes a %s row then refreshes", async (_n, view, Page) => {
    jest.useFakeTimers()
    view()
    render(<Page />)
    fireEvent.click(screen.getAllByTitle("Delete")[0])
    fireEvent.click(screen.getByText("Delete"))
    await act(() => Promise.resolve())
    expect(deleteTrn).toHaveBeenCalledWith("t1")
    expect(screen.queryByText("Delete Transaction")).not.toBeInTheDocument()
    act(() => {
      jest.advanceTimersByTime(1500)
    })
    expect(globalMutate).toHaveBeenCalledTimes(1)
    expect(swrMutate).toHaveBeenCalledTimes(1)
    jest.useRealTimers()
  })

  it.each(pages)("keeps quiet when %s delete fails", async (_n, view, Page) => {
    const consoleError = jest.spyOn(console, "error").mockImplementation()
    ;(deleteTrn as jest.Mock).mockRejectedValue(new Error("boom"))
    view()
    render(<Page />)
    fireEvent.click(screen.getAllByTitle("Delete")[0])
    fireEvent.click(screen.getByText("Delete"))
    await act(() => Promise.resolve())
    expect(swrMutate).not.toHaveBeenCalled()
    expect(screen.queryByText("Delete Transaction")).not.toBeInTheDocument()
    consoleError.mockRestore()
  })

  it("offers delete on cash ladder rows only for cash assets", () => {
    ladderView(ladder)
    render(<CashLadder />)
    expect(screen.getAllByTitle("Delete")).toHaveLength(3)
  })

  it("goes back from the header", () => {
    eventsView(events)
    render(<Events />)
    fireEvent.click(screen.getByText("Back"))
    expect(mockRouter.back).toHaveBeenCalledTimes(1)
  })

  it("switches between the trades and events tabs", () => {
    eventsView(events)
    render(<Events />)
    fireEvent.click(screen.getByRole("button", { name: "Trades" }))
    expect(mockRouter.replace).toHaveBeenCalledWith("/trns/trades/p1/a1")
  })
})
