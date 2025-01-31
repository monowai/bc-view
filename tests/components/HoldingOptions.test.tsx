import React from "react"
import { render, screen } from "@testing-library/react"
import { useRouter } from "next/router"
import "@testing-library/jest-dom"
import HoldingMenu from "@components/holdings/HoldingMenu"
import { Portfolio } from "@components/types/beancounter"

jest.mock("next/router", () => ({
  useRouter: jest.fn(),
}))

// Mocking your internal components
jest.mock("@components/Portfolios", () => ({
  Portfolios: () => <div>MockPortfolios</div>,
}))

jest.mock("swr", () => ({
  __esModule: true, // this property makes it work like an es module
  default: jest.fn(() => ({
    data: {
      data: [
        {
          code: "AUD",
          name: "Dollar",
          symbol: "$",
        },
        {
          code: "EUR",
          name: "Euro",
          symbol: "€",
        },
        {
          code: "GBP",
          name: "Pound",
          symbol: "£",
        },
        {
          code: "MYR",
          name: "Ringgit",
          symbol: "RM",
        },
        {
          code: "NZD",
          name: "Dollar",
          symbol: "$",
        },
        {
          code: "SGD",
          name: "Dollar",
          symbol: "$",
        },
        {
          code: "USD",
          name: "Dollar",
          symbol: "$",
        },
      ],
    },
    error: null,
    mutate: jest.fn(),
    isLoading: false,
  })),
}))

jest.mock("@components/HideEmpty", () => ({
  HideEmpty: () => <div>MockHideEmpty</div>,
}))

describe("<HoldingOptions />", () => {
  const mockPush = jest.fn()
  beforeEach(() => {
    ;(useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    })
  })
  const portfolio = {
    id: "123",
    code: "CODE",
    name: "Portfolio A",
    currency: { code: "USD", name: "USD", symbol: "$" },
    base: { code: "USD", name: "USD", symbol: "$" },
    irr: 0,
    marketValue: 0,
  } as Portfolio

  it("renders correctly with provided portfolio", () => {
    render(<HoldingMenu portfolio={portfolio} />)

    expect(screen.getByText("option.portfolio")).toBeInTheDocument()
    expect(screen.getByText("MockPortfolios")).toBeInTheDocument()
    expect(screen.getByText("holdings.groupBy")).toBeInTheDocument()
    expect(screen.getByText("holdings.openOnly")).toBeInTheDocument()
    expect(screen.getByText("MockHideEmpty")).toBeInTheDocument()
  })

  // Moved this code to the holding page.
  // it("navigates to transaction page when add transaction button is clicked", async () => {
  //   render(<HoldingMenu portfolio={portfolio} />)
  //
  //   fireEvent.click(screen.getByText("trn.add"))
  //   expect(screen.getByText("Add Transaction")).toBeInTheDocument()
  // })
})
