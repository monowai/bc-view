import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import CashSummaryPanel from "@components/features/rebalance/execution/CashSummaryPanel"

const baseProps = {
  currentMarketValue: 10000,
  currentCash: 1000,
  cashFromSales: 500,
  cashForPurchases: 200,
  netImpact: 300,
  projectedCash: 1300,
  currency: "USD",
}

describe("CashSummaryPanel", () => {
  it("shows the headline (Net Impact + Projected Cash) when collapsed and hides the stat cards", () => {
    render(<CashSummaryPanel {...baseProps} defaultExpanded={false} />)

    const toggle = screen.getByRole("button", { name: /cash summary/i })
    expect(toggle).toHaveAttribute("aria-expanded", "false")

    // Headline always visible, even collapsed.
    expect(screen.getByText(/Net Impact/i)).toBeInTheDocument()
    expect(screen.getByText("+300.00 USD")).toBeInTheDocument()
    expect(screen.getByText(/Projected Cash/i)).toBeInTheDocument()
    expect(screen.getByText("1,300.00 USD")).toBeInTheDocument()

    // Stat cards not rendered while collapsed.
    expect(screen.queryByText("Current Cash")).not.toBeInTheDocument()
    expect(screen.queryByText("From Sales")).not.toBeInTheDocument()
    expect(screen.queryByText("For Purchases")).not.toBeInTheDocument()
    expect(screen.queryByText("Projected Value")).not.toBeInTheDocument()
  })

  it("expands to show the full stat strip on click, and collapses again on a second click", () => {
    render(<CashSummaryPanel {...baseProps} defaultExpanded={false} />)

    const toggle = screen.getByRole("button", { name: /cash summary/i })
    fireEvent.click(toggle)

    expect(toggle).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText("Current Cash")).toBeInTheDocument()
    expect(screen.getByText("From Sales")).toBeInTheDocument()
    expect(screen.getByText("For Purchases")).toBeInTheDocument()
    expect(screen.getByText("Projected Value")).toBeInTheDocument()

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByText("Current Cash")).not.toBeInTheDocument()
  })

  it("defaults to expanded when defaultExpanded is not specified", () => {
    render(<CashSummaryPanel {...baseProps} />)

    expect(
      screen.getByRole("button", { name: /cash summary/i }),
    ).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText("Current Cash")).toBeInTheDocument()
  })

  it("colors Net Impact green when positive and red when negative", () => {
    const { rerender } = render(
      <CashSummaryPanel {...baseProps} netImpact={300} />,
    )
    expect(screen.getByTestId("cash-summary-headline-net-impact")).toHaveClass(
      "text-green-600",
    )

    rerender(<CashSummaryPanel {...baseProps} netImpact={-450.5} />)
    expect(screen.getByTestId("cash-summary-headline-net-impact")).toHaveClass(
      "text-red-600",
    )
  })

  it("renders netImpact and projectedCash exactly as passed, without recomputing them", () => {
    // netImpact/projectedCash here are deliberately inconsistent with
    // currentCash/cashFromSales/cashForPurchases to prove the component is a
    // pure display of the props it's given — not an independent calculator.
    render(
      <CashSummaryPanel
        {...baseProps}
        currentCash={1000}
        cashFromSales={0}
        cashForPurchases={0}
        netImpact={-9999}
        projectedCash={-8999}
      />,
    )

    // Both appear twice: once in the collapsed headline, once in the stat card.
    expect(
      screen.getByTestId("cash-summary-headline-net-impact"),
    ).toHaveTextContent("-9,999.00 USD")
    expect(
      screen.getByTestId("cash-summary-headline-projected-cash"),
    ).toHaveTextContent("-8,999.00 USD")
    expect(screen.getAllByText("-9,999.00 USD").length).toBe(2)
    expect(screen.getAllByText("-8,999.00 USD").length).toBe(2)
  })
})
