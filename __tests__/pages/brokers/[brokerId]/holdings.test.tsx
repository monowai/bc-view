import React from "react"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import useSwr, { useSWRConfig } from "swr"
import BrokerHoldings from "@pages/brokers/[brokerId]/holdings"

const Page = BrokerHoldings as React.ComponentType<any>

const routerState: { query: Record<string, string>; push: jest.Mock } = {
  query: { brokerId: "b1" },
  push: jest.fn(),
}
jest.mock("next/router", () => ({ useRouter: () => routerState }))
jest.mock("swr")
const mockUseSwr = useSwr as unknown as jest.Mock
const mockMutateGlobal = jest.fn()

jest.mock("@components/features/brokers/WeightedSellDialog", () => ({
  __esModule: true,
  default: (p: {
    holding: { assetCode: string }
    brokerName: string
    onClose: () => void
    onSubmitted: () => void
  }) => (
    <div>
      <span>{`sell:${p.holding.assetCode}@${p.brokerName}`}</span>
      <button onClick={p.onSubmitted}>stub-submitted</button>
      <button onClick={p.onClose}>stub-close</button>
    </div>
  ),
}))

const brokersResponse = {
  data: [
    { id: "b1", name: "Alpha Broker" },
    { id: "b2", name: "Beta Broker" },
  ],
}

const position = (
  id: string,
  code: string,
  total: number,
  name = `${code} Inc`,
): any => ({
  asset: { id, code, name, market: { code: "NASDAQ" } },
  quantityValues: { total },
})

const positionsResponse = {
  data: {
    positions: {
      zzz: position("a-z", "ZZZ", 0),
      bbb: position("a-b", "BBB", -5),
      aaa: position(
        "a-a",
        "AAA",
        12.5,
        "A very long asset name that exceeds thirty characters",
      ),
    },
  },
}

const trnsResponse = {
  brokerId: "b1",
  brokerName: "Alpha From Trns",
  holdings: [
    {
      assetId: "a-a",
      portfolioGroups: [
        {
          portfolioId: "p1",
          portfolioCode: "PORT1",
          quantity: 12.5,
          transactions: [
            {
              id: "t1",
              tradeDate: "2026-01-02",
              trnType: "BUY",
              quantity: 10,
              price: 1.5,
              tradeAmount: 15,
            },
            {
              id: "t2",
              tradeDate: "2026-01-03",
              trnType: "SELL",
              quantity: -2,
              price: 2,
              tradeAmount: 4,
            },
          ],
        },
      ],
    },
  ],
}

interface Data {
  brokers?: unknown
  positions?: unknown
  trns?: unknown
  errors?: { brokers?: Error; positions?: Error; trns?: Error }
}
function setSwr(d: Data): void {
  mockUseSwr.mockImplementation((key: unknown) => {
    const k = String(key)
    if (k === "/api/brokers")
      return { data: d.brokers, error: d.errors?.brokers }
    if (k.includes("/trns/broker/"))
      return { data: d.trns, error: d.errors?.trns }
    if (k.includes("/broker/"))
      return { data: d.positions, error: d.errors?.positions }
    return { data: undefined, error: undefined }
  })
}

describe("Broker holdings reconciliation page", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    routerState.query = { brokerId: "b1" }
    ;(useSWRConfig as jest.Mock).mockReturnValue({ mutate: mockMutateGlobal })
    setSwr({
      brokers: brokersResponse,
      positions: positionsResponse,
      trns: trnsResponse,
    })
  })

  it("shows a loader until data arrives", () => {
    setSwr({ brokers: undefined })
    render(<Page />)
    expect(screen.getByTestId("loading")).toBeInTheDocument()
  })

  it("shows an error when any request fails", () => {
    setSwr({ brokers: brokersResponse, errors: { trns: new Error("bad") } })
    render(<Page />)
    expect(
      screen.getByText(/Error loading broker holdings/),
    ).toBeInTheDocument()
  })

  it("lists non-zero positions sorted by code, with broker name from the trns response", () => {
    render(<Page />)
    expect(screen.getByText("Alpha From Trns")).toBeInTheDocument()
    expect(screen.getByText("2 of 3 positions")).toBeInTheDocument()
    const rows = screen.getAllByRole("row").map((r) => r.textContent)
    const aaa = rows.findIndex((t) => t?.includes("NASDAQ:AAA"))
    const bbb = rows.findIndex((t) => t?.includes("NASDAQ:BBB"))
    expect(aaa).toBeGreaterThan(-1)
    expect(bbb).toBeGreaterThan(aaa)
    expect(screen.queryByText("NASDAQ:ZZZ")).not.toBeInTheDocument()
    expect(screen.getAllByText("12.5").length).toBeGreaterThan(0)
    expect(
      screen.getAllByText(/^A very long asset name.*\.\.\.$/).length,
    ).toBeGreaterThan(0)
  })

  it("falls back to the broker list name, then to Unassigned", () => {
    setSwr({ brokers: brokersResponse, positions: positionsResponse })
    const { unmount } = render(<Page />)
    expect(
      screen.getByText("Alpha Broker", { selector: "h2" }),
    ).toBeInTheDocument()
    unmount()

    routerState.query = { brokerId: "NO_BROKER" }
    render(<Page />)
    expect(
      screen.getByText("Unassigned", { selector: "h2" }),
    ).toBeInTheDocument()
    // no Sell column for the unassigned sentinel
    expect(screen.queryByTitle("Sell")).not.toBeInTheDocument()
  })

  it("shows zero quantities when toggled", async () => {
    const user = userEvent.setup()
    render(<Page />)
    await user.click(screen.getByLabelText("Show zero quantities"))
    expect(screen.getAllByText("NASDAQ:ZZZ").length).toBeGreaterThan(0)
    expect(screen.getByText("3 positions")).toBeInTheDocument()
  })

  it("expands a holding to show transactions across portfolios, and collapses it", async () => {
    const user = userEvent.setup()
    render(<Page />)
    const qtyBtn = screen.getAllByTitle("Click to view transactions")[0]
    await user.click(qtyBtn)
    expect(screen.getAllByText("PORT1").length).toBeGreaterThan(0)
    expect(screen.getAllByText("2026-01-02").length).toBeGreaterThan(0)
    expect(screen.getByText("1.50")).toBeInTheDocument()
    const link = screen.getAllByTitle("Edit")[0].closest("a")
    expect(link).toHaveAttribute("href", "/trns/trades/edit/p1/t1")
    await user.click(qtyBtn)
    expect(screen.queryAllByText("2026-01-02")).toHaveLength(0)
    expect(screen.queryByText("PORT1")).not.toBeInTheDocument()
  })

  it("marks assets reconciled and unreconciled", async () => {
    const user = userEvent.setup()
    render(<Page />)
    await user.click(screen.getAllByTitle("Mark as reconciled")[0])
    expect(screen.getByText("1 reconciled")).toBeInTheDocument()
    await user.click(screen.getAllByTitle("Mark as unreconciled")[0])
    expect(screen.queryByText("1 reconciled")).not.toBeInTheDocument()
  })

  it("navigates when another broker is chosen and when going back", async () => {
    const user = userEvent.setup()
    render(<Page />)
    await user.selectOptions(screen.getByRole("combobox"), "b2")
    expect(routerState.push).toHaveBeenCalledWith("/brokers/b2/holdings")
    await user.click(screen.getByTitle("Back"))
    expect(routerState.push).toHaveBeenCalledWith("/brokers")
  })

  it("opens the sell dialog for a holding and refreshes data on submit", async () => {
    const user = userEvent.setup()
    render(<Page />)
    await user.click(screen.getAllByTitle("Sell")[0])
    expect(screen.getByText("sell:AAA@Alpha From Trns")).toBeInTheDocument()
    await user.click(screen.getByText("stub-submitted"))
    expect(mockMutateGlobal).toHaveBeenCalledTimes(2)
    await user.click(screen.getByText("stub-close"))
    expect(screen.queryByText(/^sell:/)).not.toBeInTheDocument()
  })

  it("explains an empty broker, and the all-assigned case", () => {
    setSwr({
      brokers: brokersResponse,
      positions: { data: { positions: {} } },
    })
    const { unmount } = render(<Page />)
    expect(screen.getByText("No holdings for this broker")).toBeInTheDocument()
    unmount()
    routerState.query = { brokerId: "NO_BROKER" }
    render(<Page />)
    expect(
      screen.getByText("All transactions have brokers assigned"),
    ).toBeInTheDocument()
    expect(within(document.body).getByText("Manage")).toBeInTheDocument()
  })
})
