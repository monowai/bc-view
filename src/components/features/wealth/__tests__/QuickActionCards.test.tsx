import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import QuickActionCards from "../QuickActionCards"

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

  it("clicking the zen-mode Pay Slip card asks for the payslip", () => {
    const onPayslip = jest.fn()
    render(<QuickActionCards zenMode={true} onPayslip={onPayslip} />)
    fireEvent.click(screen.getByText("Pay Slip"))
    expect(onPayslip).toHaveBeenCalledTimes(1)
  })
})
