import React from "react"
import { render, screen, within } from "@testing-library/react"
import "@testing-library/jest-dom"
import TradeInputForm from "../TradeInputForm"
import { makePortfolio, USD } from "@test-fixtures/beancounter"

// A deactivated broker keeps its transactions and is not offered for a new
// trade.

const brokers = [
  { id: "ib", name: "IB", active: true, settlementAccounts: [] },
  { id: "scb", name: "SCB", settlementAccounts: [] },
  { id: "dbs", name: "DBS", active: false, settlementAccounts: [] },
]

jest.mock("swr", () => ({
  __esModule: true,
  default: (key: string | null) => {
    const empty = { data: undefined, error: undefined, isLoading: false }
    if (!key) return empty
    if (key.includes("/api/brokers"))
      return { data: { data: brokers }, error: undefined, isLoading: false }
    if (key.includes("currencies"))
      return {
        data: { data: [{ code: "USD" }] },
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

jest.mock("@components/features/assets/AssetSearch", () => ({
  __esModule: true,
  default: () => <input aria-label="Asset" readOnly />,
}))

const portfolio = makePortfolio({
  marketValue: 10000,
  currency: USD,
  base: USD,
})

describe("TradeInputForm: brokers offered", () => {
  test("a new trade is offered the active brokers only", () => {
    render(
      <TradeInputForm
        portfolio={portfolio}
        modalOpen={true}
        setModalOpen={jest.fn()}
        initialValues={
          {
            asset: "AAPL",
            market: "NASDAQ",
            quantity: 10,
            price: 100,
            currency: "USD",
            type: "BUY",
          } as never
        }
      />,
    )

    const brokerSelect = screen
      .getByText("-- No account --")
      .closest("select") as HTMLSelectElement
    const offered = within(brokerSelect)
      .getAllByRole("option")
      .map((option) => option.textContent)

    expect(offered).toEqual(["-- No account --", "IB", "SCB"])
  })
})
