import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import useSwr from "swr"
import Allocation from "@pages/allocation"

const Page = Allocation as React.ComponentType<any>

const routerState: { query: Record<string, string> } = { query: {} }
jest.mock("next/router", () => ({ useRouter: () => routerState }))
jest.mock("swr")
const mockUseSwr = useSwr as unknown as jest.Mock

const mockPostFx = jest.fn()
jest.mock("@utils/api/client/fx", () => ({
  postFxRates: (...a: unknown[]) => mockPostFx(...a),
}))
const mockTransform = jest.fn()
jest.mock("@lib/allocation/aggregateHoldings", () => ({
  transformToAllocationSlices: (...a: unknown[]) => mockTransform(...a),
}))
jest.mock("@components/features/allocation/AllocationChart", () => ({
  __esModule: true,
  default: (p: {
    data: { name: string; value: number }[]
    totalValue: number
    currencySymbol: string
  }) => (
    <div>
      {`chart:${p.currencySymbol}:${p.totalValue}:`}
      {p.data.map((d) => `${d.name}=${d.value}`).join(",")}
    </div>
  ),
}))
jest.mock("@components/features/allocation/AllocationControls", () => ({
  __esModule: true,
  default: (p: {
    groupBy: string
    valueIn: string
    onGroupByChange: (g: string) => void
    onValueInChange: (v: string) => void
  }) => (
    <div>
      <span>{`controls:${p.groupBy}:${p.valueIn}`}</span>
      <button onClick={() => p.onGroupByChange("market")}>group-market</button>
      <button onClick={() => p.onValueInChange("TRADE")}>value-trade</button>
    </div>
  ),
}))

const usd = { id: "USD", code: "USD", symbol: "$" }
const sgd = { id: "SGD", code: "SGD", symbol: "S$" }

function setSwr(opts: {
  holdings?: unknown
  error?: Error
  loading?: boolean
}): void {
  mockUseSwr.mockImplementation((key: unknown) => {
    if (String(key).endsWith("/currencies"))
      return { data: { data: [usd, sgd] } }
    return { data: opts.holdings, error: opts.error, isLoading: opts.loading }
  })
}

const holdings = { data: { portfolio: { currency: usd } } }

describe("Allocation page", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    routerState.query = {}
    mockTransform.mockReturnValue([
      { name: "Equity", value: 100 },
      { name: "Cash", value: 50 },
    ])
    setSwr({ holdings })
    jest.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => jest.restoreAllMocks())

  it("shows loader and error states", () => {
    setSwr({ loading: true })
    const a = render(<Page />)
    expect(screen.getByTestId("loading")).toBeInTheDocument()
    a.unmount()
    setSwr({ error: new Error("x") })
    render(<Page />)
    expect(
      screen.getByText(/Failed to load allocation data/),
    ).toBeInTheDocument()
  })

  it.each([
    [undefined, "Showing allocation across all portfolios"],
    ["ABC", "Showing allocation for ABC"],
    ["A,B", "Showing allocation for 2 portfolios: A,B"],
  ])("subtitle for codes=%s", (codes, expected) => {
    routerState.query = codes ? { codes } : {}
    render(<Page />)
    expect(screen.getByText(expected)).toBeInTheDocument()
  })

  it("charts the slices in the portfolio currency with their total", () => {
    render(<Page />)
    expect(
      screen.getByText("chart:$:150:Equity=100,Cash=50"),
    ).toBeInTheDocument()
    expect(screen.getByText("controls:category:PORTFOLIO")).toBeInTheDocument()
    expect(mockPostFx).not.toHaveBeenCalled()
  })

  it("passes grouping and value-basis changes to the aggregation", async () => {
    const user = userEvent.setup()
    render(<Page />)
    await user.click(screen.getByText("group-market"))
    await user.click(screen.getByText("value-trade"))
    const last = mockTransform.mock.calls[mockTransform.mock.calls.length - 1]
    expect(last[1]).toBe("market")
    expect(last[2]).toBe("TRADE")
  })

  it("converts values with the FX rate when another display currency is chosen", async () => {
    mockPostFx.mockResolvedValue({
      json: () =>
        Promise.resolve({ data: { rates: { "USD:SGD": { rate: 2 } } } }),
    })
    const user = userEvent.setup()
    render(<Page />)
    await user.selectOptions(screen.getByTitle("Display Currency"), "SGD")
    expect(
      await screen.findByText("chart:S$:300:Equity=200,Cash=100"),
    ).toBeInTheDocument()
    expect(mockPostFx).toHaveBeenCalledWith({
      rateDate: "today",
      pairs: [{ from: "USD", to: "SGD" }],
    })
  })

  it("keeps the unconverted values when the FX lookup fails", async () => {
    mockPostFx.mockRejectedValue(new Error("fx down"))
    const user = userEvent.setup()
    render(<Page />)
    await user.selectOptions(screen.getByTitle("Display Currency"), "SGD")
    await waitFor(() => expect(mockPostFx).toHaveBeenCalled())
    expect(
      screen.getByText("chart:S$:150:Equity=100,Cash=50"),
    ).toBeInTheDocument()
  })

  it("shows an empty chart before holdings carry a currency", () => {
    setSwr({ holdings: { data: undefined } })
    render(<Page />)
    expect(screen.getByText("chart:$:0:")).toBeInTheDocument()
    expect(screen.queryByTitle("Display Currency")).not.toBeInTheDocument()
  })
})
