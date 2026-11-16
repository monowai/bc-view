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

const permissions = { admin: true }
jest.mock("@hooks/usePermissions", () => ({
  usePermissions: () => permissions,
}))

describe("Brokers Page", () => {
  afterEach(() => {
    jest.clearAllMocks()
    permissions.admin = true
  })

  it("opens a brokerage account through the wizard", () => {
    permissions.admin = false
    render(<BrokersPage />)
    fireEvent.click(
      screen.getAllByRole("button", { name: /Open Brokerage Account/ })[0],
    )
    expect(mockPush).toHaveBeenCalledWith("/tools/open-brokerage")
  })

  it("does not offer the add dialog to a user who is not an admin", () => {
    permissions.admin = false
    render(<BrokersPage />)
    expect(
      screen.queryByRole("button", { name: /Add Brokerage Account/ }),
    ).not.toBeInTheDocument()
  })

  it("offers the add dialog to an admin", () => {
    render(<BrokersPage />)
    fireEvent.click(
      screen.getByRole("button", { name: /Add Brokerage Account/ }),
    )
    expect(
      screen.getByRole("heading", { name: "Add Brokerage Account" }),
    ).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it("offers Import from screenshot from the page header", () => {
    render(<BrokersPage />)
    fireEvent.click(
      screen.getByRole("button", { name: "Import from screenshot" }),
    )
    expect(mockPush).toHaveBeenCalledWith("/brokers/import")
  })
})
