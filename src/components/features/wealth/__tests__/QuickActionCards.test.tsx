import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import QuickActionCards from "../QuickActionCards"

// PayslipModal pulls in SWR/auth/context; stub it to a marker that echoes
// whether it was opened.
jest.mock("@components/features/transactions/PayslipModal", () => ({
  __esModule: true,
  default: ({ modalOpen }: { modalOpen: boolean }) =>
    modalOpen ? <div data-testid="payslip-modal">payslip open</div> : null,
}))

// Keep React in scope for JSX without tripping the unused-import lint.
void React

describe("QuickActionCards", () => {
  it("master mode shows Aggregated Holdings, not Pay Slip", () => {
    render(<QuickActionCards />)
    expect(screen.getByText("Aggregated Holdings")).toBeInTheDocument()
    expect(screen.queryByText("Pay Slip")).not.toBeInTheDocument()
  })

  it("zen mode swaps Aggregated Holdings for a Pay Slip action", () => {
    render(<QuickActionCards zenMode={true} />)
    expect(screen.queryByText("Aggregated Holdings")).not.toBeInTheDocument()
    expect(screen.getByText("Pay Slip")).toBeInTheDocument()
  })

  it("clicking the zen-mode Pay Slip card opens the payslip modal", () => {
    render(<QuickActionCards zenMode={true} />)
    expect(screen.queryByTestId("payslip-modal")).not.toBeInTheDocument()
    fireEvent.click(screen.getByText("Pay Slip"))
    expect(screen.getByTestId("payslip-modal")).toBeInTheDocument()
  })
})
