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

  it("offers Open Brokerage from the page header", () => {
    render(<BrokersPage />)
    const button = screen.getByRole("button", { name: /Open Brokerage/i })
    fireEvent.click(button)
    expect(mockPush).toHaveBeenCalledWith("/tools/open-brokerage")
  })
})
