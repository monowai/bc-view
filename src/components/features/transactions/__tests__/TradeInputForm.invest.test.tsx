import React from "react"
import { render, screen, fireEvent, within } from "@testing-library/react"
import "@testing-library/jest-dom"
import TradeInputForm from "../TradeInputForm"
import { makePortfolio, USD } from "@test-fixtures/beancounter"

// The Invest tab sizes a trade three equivalent ways — cash amount, share
// count, target weight. These tests pin the rule that all three stay in step
// with the single underlying quantity, whichever one the user edits.

const mockBrokers = {
  data: [
    { id: "ib", name: "Interactive Brokers", settlementAccounts: [] },
    { id: "asb", name: "ASB Securities", settlementAccounts: [] },
  ],
}

jest.mock("swr", () => ({
  __esModule: true,
  default: (key: string | null) => {
    if (!key) return { data: undefined, error: undefined, isLoading: false }
    if (key.includes("brokers"))
      return { data: mockBrokers, error: undefined, isLoading: false }
    if (key.includes("portfolios"))
      return {
        data: { data: [] },
        error: undefined,
        isLoading: false,
      }
    if (key.includes("markets"))
      return {
        data: {
          data: [{ code: "NASDAQ", name: "NASDAQ", currency: { code: "USD" } }],
        },
        error: undefined,
        isLoading: false,
      }
    if (key.includes("currencies"))
      return {
        data: { data: [{ code: "USD" }] },
        error: undefined,
        isLoading: false,
      }
    return { data: { data: [] }, error: undefined, isLoading: false }
  },
  mutate: jest.fn(),
}))

jest.mock("@contexts/UserPreferencesContext", () => ({
  useUserPreferences: () => ({
    preferences: { id: "u1" },
    isLoading: false,
    refetch: jest.fn(),
  }),
}))

// AssetSearch reaches for the asset API on mount; the Invest tab doesn't
// exercise it, so a stub keeps the test to the sizing behaviour.
jest.mock("@components/features/assets/AssetSearch", () => ({
  __esModule: true,
  default: () => <input aria-label="Asset" readOnly />,
}))

const portfolio = makePortfolio({
  marketValue: 10000,
  currency: USD,
  base: USD,
})

// A holding of 100 @ 10 in a 10,000 portfolio: 1,000 held = 10% weight.
const heldPosition = {
  asset: "AAPL",
  assetId: "a-1",
  market: "NASDAQ",
  quantity: 100,
  price: 10,
  currency: "USD",
  type: "BUY" as const,
}

const renderInvestTab = (
  initialValues: Record<string, unknown> = heldPosition,
): void => {
  render(
    <TradeInputForm
      portfolio={portfolio}
      modalOpen={true}
      setModalOpen={jest.fn()}
      initialValues={initialValues as never}
    />,
  )
  fireEvent.click(screen.getByRole("button", { name: "Invest" }))
}

const amountField = (): HTMLInputElement =>
  screen.getByLabelText("Amount to invest") as HTMLInputElement
const sharesField = (): HTMLInputElement =>
  screen.getByLabelText("Shares to trade") as HTMLInputElement
const weightField = (): HTMLInputElement =>
  screen.getByLabelText("Target weight") as HTMLInputElement

describe("TradeInputForm — Invest tab", () => {
  test("labels the current holding rather than leaving its figures unexplained", () => {
    renderInvestTab()

    const held = screen.getByTestId("invest-current-position")
    expect(within(held).getByText(/Currently held/i)).toBeInTheDocument()
    expect(within(held).getByText("100")).toBeInTheDocument()
    expect(within(held).getByText("10.00%")).toBeInTheDocument()
  })

  test("a target weight change flows through to the amount and share count", () => {
    renderInvestTab()

    fireEvent.change(weightField(), { target: { value: "15" } })

    // 15% of 10,000 = 1,500 against 1,000 held → buy 50 shares for 500.
    expect(sharesField()).toHaveValue("50")
    expect(amountField()).toHaveValue("500")
  })

  test("an amount change flows through to the share count and target weight", () => {
    renderInvestTab()

    fireEvent.change(amountField(), { target: { value: "1000" } })

    // 1,000 buys 100 shares, taking the holding to 2,000 of 10,000 = 20%.
    expect(sharesField()).toHaveValue("100")
    expect(weightField()).toHaveValue("20")
  })

  test("a share-count change flows through to the amount and target weight", () => {
    renderInvestTab()

    fireEvent.change(sharesField(), { target: { value: "25" } })

    expect(amountField()).toHaveValue("250")
    expect(weightField()).toHaveValue("12.5")
  })

  test("a target weight below the current one sizes a SELL", () => {
    renderInvestTab()

    fireEvent.change(weightField(), { target: { value: "4" } })

    expect(sharesField()).toHaveValue("60")
    expect(screen.getByTestId("invest-direction")).toHaveTextContent("SELL")
  })

  test("shows the resulting position beside the current one", () => {
    renderInvestTab()

    fireEvent.change(weightField(), { target: { value: "15" } })

    const after = screen.getByTestId("invest-resulting-position")
    expect(within(after).getByText("150")).toBeInTheDocument()
    expect(within(after).getByText("15.00%")).toBeInTheDocument()
  })

  test("the broker can be changed without leaving the tab", () => {
    renderInvestTab()

    const broker = screen.getByLabelText("Broker") as HTMLSelectElement
    fireEvent.change(broker, { target: { value: "asb" } })
    expect(broker.value).toBe("asb")
  })

  test("price is editable on the tab that divides by it", () => {
    renderInvestTab()

    fireEvent.change(sharesField(), { target: { value: "10" } })
    expect(amountField()).toHaveValue("100")

    fireEvent.change(screen.getByLabelText("Price"), {
      target: { value: "20" },
    })
    expect(amountField()).toHaveValue("200")
  })

  test("a brand-new position sizes against the post-trade portfolio", () => {
    renderInvestTab({
      asset: "MSFT",
      assetId: "a-2",
      market: "NASDAQ",
      quantity: 0,
      price: 10,
      currency: "USD",
      type: "BUY",
    })

    expect(screen.getByTestId("invest-current-position")).toHaveTextContent(
      /New position/i,
    )

    fireEvent.change(weightField(), { target: { value: "50" } })
    // V / (10,000 + V) = 50% → V = 10,000 → 1,000 shares.
    expect(sharesField()).toHaveValue("1000")
    expect(amountField()).toHaveValue("10000")
  })
})
