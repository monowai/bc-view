import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import useSwr from "swr"
import SelectPortfoliosStep from "../SelectPortfoliosStep"
import { makePortfolio } from "@test-fixtures/beancounter"
import { Portfolio } from "types/beancounter"

jest.mock("swr", () => ({
  __esModule: true,
  default: jest.fn(),
}))
const mockedUseSwr = useSwr as jest.MockedFunction<typeof useSwr>

function mockPortfolios(portfolios: Portfolio[]): void {
  mockedUseSwr.mockReturnValue({
    data: { data: portfolios },
    error: undefined,
    isLoading: false,
    mutate: jest.fn(),
  } as unknown as ReturnType<typeof useSwr>)
}

const nzdPortfolio = makePortfolio({
  id: "p-nzd",
  code: "NZD1",
  name: "NZ Portfolio",
  currency: { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$" },
})
const usdPortfolio = makePortfolio({
  id: "p-usd",
  code: "USD1",
  name: "US Portfolio",
  currency: { code: "USD", name: "US Dollar", symbol: "$" },
})
const usdPortfolio2 = makePortfolio({
  id: "p-usd2",
  code: "USD2",
  name: "US Portfolio 2",
  currency: { code: "USD", name: "US Dollar", symbol: "$" },
})

describe("SelectPortfoliosStep — mixed-currency guard (#1156)", () => {
  const onChange = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("shows no currency warning when only one portfolio is selected", () => {
    mockPortfolios([nzdPortfolio, usdPortfolio])
    render(
      <SelectPortfoliosStep
        selectedPortfolioIds={["p-nzd"]}
        onChange={onChange}
      />,
    )

    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("shows no currency warning when every selected portfolio shares the same currency", () => {
    mockPortfolios([usdPortfolio, usdPortfolio2])
    render(
      <SelectPortfoliosStep
        selectedPortfolioIds={["p-usd", "p-usd2"]}
        onChange={onChange}
      />,
    )

    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("warns when the selected set spans more than one report currency", () => {
    mockPortfolios([nzdPortfolio, usdPortfolio])
    render(
      <SelectPortfoliosStep
        selectedPortfolioIds={["p-nzd", "p-usd"]}
        onChange={onChange}
      />,
    )

    const warning = screen.getByRole("alert")
    expect(warning).toHaveTextContent(/currenc/i)
    expect(warning).toHaveTextContent("NZD")
    expect(warning).toHaveTextContent("USD")
  })

  it("does not block selection — every portfolio checkbox stays enabled while the warning is shown", () => {
    mockPortfolios([nzdPortfolio, usdPortfolio])
    render(
      <SelectPortfoliosStep
        selectedPortfolioIds={["p-nzd", "p-usd"]}
        onChange={onChange}
      />,
    )

    screen.getAllByRole("checkbox").forEach((checkbox) => {
      expect(checkbox).not.toBeDisabled()
    })
  })
})
