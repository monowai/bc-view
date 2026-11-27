import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import TradeInputForm from "../TradeInputForm"
import { makePortfolio, USD } from "@test-fixtures/beancounter"

const portfolio = makePortfolio({
  id: "p1",
  code: "ONE",
  name: "First",
  marketValue: 10000,
  currency: USD,
  base: USD,
})
const other = makePortfolio({
  id: "p2",
  code: "TWO",
  name: "Second",
  currency: USD,
  base: USD,
})

jest.mock("swr", () => ({
  __esModule: true,
  default: (key: string | null) => {
    const empty = { data: undefined, error: undefined, isLoading: false }
    if (!key) return empty
    if (key === "/api/portfolios")
      return {
        data: { data: [portfolio, other] },
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

const managed = makePortfolio({
  id: "m1",
  code: "MGD",
  name: "Managed",
  currency: USD,
  base: USD,
})

const renderForm = (opened = portfolio): void => {
  render(
    <TradeInputForm
      portfolio={opened}
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
}

describe("TradeInputForm: layout", () => {
  // The portfolio is context, not a field: it sits on the line under the
  // title, so the fields fit one view without scrolling.
  test("the portfolio is chosen on the context line, not in the form body", () => {
    renderForm()
    const picker = screen.getByRole("combobox", { name: "Portfolio" })
    expect(picker).toHaveValue("p1")
    expect(document.getElementById("trade-form")).not.toContainElement(picker)
  })

  test("choosing another portfolio says so", () => {
    renderForm()
    fireEvent.change(screen.getByRole("combobox", { name: "Portfolio" }), {
      target: { value: "p2" },
    })
    expect(screen.getByText("Different from current portfolio")).toBeVisible()
  })

  // The list holds only the user's own portfolios. A portfolio they manage for
  // someone else is not in it, and a select would show the first option while
  // the trade still lands in the managed one.
  test("a portfolio missing from the list is shown, not switched", () => {
    renderForm(managed)
    expect(
      screen.queryByRole("combobox", { name: "Portfolio" }),
    ).not.toBeInTheDocument()
    expect(screen.getByText("MGD · Managed")).toBeVisible()
  })

  // The trade tab is where the trade is described, so its note sits there too.
  test("comments are on the trade tab", () => {
    renderForm()
    expect(screen.getByRole("textbox", { name: "Comments" })).toBeVisible()
  })
})
