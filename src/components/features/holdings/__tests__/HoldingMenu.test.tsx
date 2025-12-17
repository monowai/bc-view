import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import HoldingMenu from "../HoldingMenu"
import { Portfolio } from "types/beancounter"

// Mock next-i18next
jest.mock("next-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    ready: true,
  }),
}))

// Mock child components
jest.mock("@components/ui/HideEmpty", () => ({
  HideEmpty: () => <div data-testid="hide-empty">HideEmpty</div>,
}))

// Mock Portfolios component - but use the actual component to test integration
jest.mock("@components/features/portfolios/Portfolios", () => ({
  Portfolios: ({ ...props }: any) => (
    <div data-testid="portfolios">
      <button data-testid="portfolio-button">{props.name || "No name"}</button>
    </div>
  ),
}))

jest.mock("@components/features/holdings/GroupByOptions", () => {
  return function GroupByOptions() {
    return <div data-testid="group-by-options">GroupByOptions</div>
  }
})

jest.mock("@components/ui/ValueIn", () => {
  return function ValueInOption() {
    return <div data-testid="value-in-option">ValueInOption</div>
  }
})

jest.mock("@components/ui/DisplayCurrencyOption", () => {
  return function DisplayCurrencyOption() {
    return (
      <div data-testid="display-currency-option">DisplayCurrencyOption</div>
    )
  }
})

const mockPortfolio: Portfolio = {
  id: "test-portfolio",
  code: "TEST",
  name: "Test Portfolio",
  currency: { code: "USD", name: "US Dollar", symbol: "$" },
  base: { code: "USD", name: "US Dollar", symbol: "$" },
  marketValue: 10000,
  irr: 0.1,
}

describe("HoldingMenu Visual Cues and Mobile Support (TDD)", () => {
  it("should display the selected portfolio name in the menu", () => {
    render(<HoldingMenu portfolio={mockPortfolio} />)

    // Open menu
    const trigger = screen.getByLabelText("Open menu")
    fireEvent.click(trigger)

    // Should show the portfolio name, not "Loading..."
    const portfolioButton = screen.getByTestId("portfolio-button")
    expect(portfolioButton).toHaveTextContent("Test Portfolio")
    expect(portfolioButton).not.toHaveTextContent("Loading...")
  })

  it("should render a visual menu trigger with icon", () => {
    render(<HoldingMenu portfolio={mockPortfolio} />)

    // Should have a visible trigger area with chevron or menu icon
    const trigger = screen.getByLabelText("Open menu")
    expect(trigger).toBeInTheDocument()
    expect(trigger).toHaveClass("cursor-pointer")
  })

  it("should show menu when trigger is clicked (mobile support)", () => {
    render(<HoldingMenu portfolio={mockPortfolio} />)

    const trigger = screen.getByLabelText("Open menu")
    fireEvent.click(trigger)

    // Menu should be visible
    expect(screen.getByText("option.portfolio")).toBeInTheDocument()
  })

  it("should render a close button inside the menu", () => {
    render(<HoldingMenu portfolio={mockPortfolio} />)

    // Open menu
    const trigger = screen.getByLabelText("Open menu")
    fireEvent.click(trigger)

    // Close button should be visible
    const closeButton = screen.getByLabelText("Close menu")
    expect(closeButton).toBeInTheDocument()
  })

  it("should close menu when close button is clicked", () => {
    render(<HoldingMenu portfolio={mockPortfolio} />)

    // Open menu
    const trigger = screen.getByLabelText("Open menu")
    fireEvent.click(trigger)

    // Click close button
    const closeButton = screen.getByLabelText("Close menu")
    fireEvent.click(closeButton)

    // Menu should have translate-x-full class (hidden)
    const menu = closeButton.closest(".fixed")
    expect(menu).toHaveClass("-translate-x-full")
  })

  it("should render backdrop overlay when menu is open", () => {
    render(<HoldingMenu portfolio={mockPortfolio} />)

    // Open menu
    const trigger = screen.getByLabelText("Open menu")
    fireEvent.click(trigger)

    // Backdrop should be visible
    const backdrop = screen.getByTestId("menu-backdrop")
    expect(backdrop).toBeInTheDocument()
  })

  it("should close menu when backdrop is clicked", () => {
    render(<HoldingMenu portfolio={mockPortfolio} />)

    // Open menu
    const trigger = screen.getByLabelText("Open menu")
    fireEvent.click(trigger)

    // Click backdrop
    const backdrop = screen.getByTestId("menu-backdrop")
    fireEvent.click(backdrop)

    // Menu should be closed
    const menu = document.querySelector(".fixed.w-64")
    expect(menu).toHaveClass("-translate-x-full")
  })

  it("should close menu when mouse leaves the menu panel", () => {
    render(<HoldingMenu portfolio={mockPortfolio} />)

    // Open menu
    const trigger = screen.getByLabelText("Open menu")
    fireEvent.click(trigger)

    // Verify menu is open
    const menu = document.querySelector(".fixed.w-64")
    expect(menu).not.toHaveClass("-translate-x-full")

    // Mouse leave from menu panel
    if (menu) {
      fireEvent.mouseLeave(menu)
    }

    // Menu should be closed
    expect(menu).toHaveClass("-translate-x-full")
  })
})
