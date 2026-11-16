import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import Brokers from "@pages/brokers"

// Cast to any since withPageAuthRequired HOC strips prop types in v4
const BrokersPage = Brokers as React.ComponentType<any>

const mockPush = jest.fn()
jest.mock("next/router", () => ({
  useRouter: () => ({
    push: mockPush,
    back: jest.fn(),
  }),
}))

jest.mock("@hooks/useBrokers", () => ({
  useBrokers: () => ({
    brokers: [],
    accountAssets: [],
    error: undefined,
    isLoading: false,
    saveBroker: jest.fn(),
    deleteBroker: jest.fn(),
    transferTransactions: jest.fn(),
  }),
}))

describe("Brokers Page", () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it("opens the account dialog from the one header action", () => {
    render(<BrokersPage />)
    fireEvent.click(
      screen.getAllByRole("button", { name: /Open Brokerage Account/ })[0],
    )
    expect(
      screen.getByRole("heading", { name: "Open Brokerage Account" }),
    ).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it("offers the portfolio and cash set-up from the dialog", () => {
    render(<BrokersPage />)
    fireEvent.click(
      screen.getAllByRole("button", { name: /Open Brokerage Account/ })[0],
    )
    fireEvent.click(
      screen.getByRole("button", {
        name: "Set up a portfolio and cash accounts too",
      }),
    )
    expect(mockPush).toHaveBeenCalledWith("/tools/open-brokerage")
  })
})
