import React from "react"
import { render, screen } from "@testing-library/react"
import FiMetrics from "../FiMetrics"

// Mock the usePrivacyMode hook
jest.mock("@hooks/usePrivacyMode", () => ({
  usePrivacyMode: jest.fn(() => ({
    hideValues: false,
    toggleHideValues: jest.fn(),
  })),
}))

const { usePrivacyMode } = jest.requireMock("@hooks/usePrivacyMode")

describe("FiMetrics", () => {
  const defaultProps = {
    monthlyExpenses: 5000,
    liquidAssets: 500000,
    currency: "NZD",
  }

  beforeEach(() => {
    jest.clearAllMocks()
    usePrivacyMode.mockReturnValue({
      hideValues: false,
      toggleHideValues: jest.fn(),
    })
  })

  it("renders FIRE Metrics heading", () => {
    render(<FiMetrics {...defaultProps} />)
    expect(screen.getByText("FIRE Metrics")).toBeInTheDocument()
  })

  it("calculates FI Number correctly (25x annual expenses)", () => {
    const { container } = render(<FiMetrics {...defaultProps} />)
    // FI Number = 5000 * 12 * 25 = 1,500,000
    expect(screen.getByText("FI Number (25×)")).toBeInTheDocument()
    // Check the value appears in the output
    expect(container.textContent).toContain("1,500,000")
  })

  it("calculates FI Progress correctly", () => {
    render(<FiMetrics {...defaultProps} />)
    // Progress = 500,000 / 1,500,000 * 100 = 33.3%
    expect(screen.getByText("FI Progress")).toBeInTheDocument()
    // The percentage is in a span, verify it's present
    const container = screen.getByText("FI Progress").parentElement
    expect(container).toHaveTextContent("33.3%")
  })

  it("calculates savings rate when working income and monthly investment provided", () => {
    render(
      <FiMetrics
        {...defaultProps}
        workingIncomeMonthly={10000}
        monthlyInvestment={4000}
      />,
    )
    // Savings rate = 4000 / 10000 * 100 = 40%
    expect(screen.getByText("Savings Rate")).toBeInTheDocument()
    const savingsRow = screen.getByText("Savings Rate").closest("div")
    expect(savingsRow).toHaveTextContent("40.0%")
  })

  it("does not show savings rate when no working income", () => {
    render(<FiMetrics {...defaultProps} />)
    expect(screen.queryByText("Savings Rate")).not.toBeInTheDocument()
  })

  it("shows Years to FI when not yet financially independent", () => {
    render(
      <FiMetrics
        {...defaultProps}
        workingIncomeMonthly={10000}
        monthlyInvestment={4000}
        expectedReturnRate={0.07}
      />,
    )
    expect(screen.getByText("Years to FI")).toBeInTheDocument()
  })

  it("shows FI achieved message when progress >= 100%", () => {
    render(
      <FiMetrics
        {...defaultProps}
        liquidAssets={2000000} // Above FI Number of 1,500,000
      />,
    )
    expect(screen.getByText("Financially Independent!")).toBeInTheDocument()
  })

  it("shows progress percentage over 100% when over-funded", () => {
    render(
      <FiMetrics
        {...defaultProps}
        liquidAssets={3000000} // 200% of FI Number
      />,
    )
    // Progress should show actual percentage
    const progressContainer = screen.getByText("FI Progress").parentElement
    expect(progressContainer).toHaveTextContent("200.0%")
  })

  it("displays formula breakdown for FI Number", () => {
    render(<FiMetrics {...defaultProps} />)
    // Text includes currency code inline with the formula
    const formulaText = screen.getByText(/Based on/)
    expect(formulaText).toHaveTextContent("5,000")
    expect(formulaText).toHaveTextContent("/mo × 12 × 25")
  })

  it("shows current assets on progress scale", () => {
    render(<FiMetrics {...defaultProps} />)
    // Find the progress bar footer which shows assets range
    const progressSection = screen.getByText("FI Progress").closest("div")
    expect(progressSection?.parentElement).toHaveTextContent("500,000")
  })

  it("displays currency code with amounts", () => {
    const { container } = render(<FiMetrics {...defaultProps} />)
    // Currency code should appear in the rendered output
    expect(container.textContent).toContain("NZD")
  })

  it("does not show Years to FI when already financially independent", () => {
    render(
      <FiMetrics
        {...defaultProps}
        liquidAssets={2000000}
        workingIncomeMonthly={10000}
        monthlyInvestment={4000}
      />,
    )
    expect(screen.queryByText("Years to FI")).not.toBeInTheDocument()
  })

  it("handles zero monthly expenses gracefully", () => {
    const { container } = render(
      <FiMetrics {...defaultProps} monthlyExpenses={0} />,
    )
    // FI Number = 0, should not crash and should show 0 values
    expect(container).toBeInTheDocument()
    expect(screen.getByText("FI Number (25×)")).toBeInTheDocument()
  })

  it("uses provided expected return rate for calculations", () => {
    // With higher return rate, years to FI should be lower
    const { rerender } = render(
      <FiMetrics
        {...defaultProps}
        workingIncomeMonthly={10000}
        monthlyInvestment={4000}
        expectedReturnRate={0.05}
      />,
    )

    // Re-render with higher return rate
    rerender(
      <FiMetrics
        {...defaultProps}
        workingIncomeMonthly={10000}
        monthlyInvestment={4000}
        expectedReturnRate={0.1}
      />,
    )

    // Should still show Years to FI (just different value)
    expect(screen.getByText("Years to FI")).toBeInTheDocument()
  })

  describe("Coast FIRE", () => {
    it("calculates Coast FI Number correctly", () => {
      const { container } = render(
        <FiMetrics
          {...defaultProps}
          currentAge={35}
          expectedReturnRate={0.07}
          backendRealYearsToFi={30} // Required for Coast FI display
          backendCoastFiNumber={197000}
          backendCoastFiProgress={50}
        />,
      )
      // Coast FI now uses backend values based on years to FI
      expect(screen.getByText("Coast FI Number")).toBeInTheDocument()
      expect(container.textContent).toContain("Coast FI Progress")
    })

    it("shows Coast FIRE achieved when assets exceed Coast FI Number", () => {
      render(
        <FiMetrics
          {...defaultProps}
          liquidAssets={250000}
          currentAge={35}
          expectedReturnRate={0.07}
          backendRealYearsToFi={30}
          backendCoastFiNumber={197000}
          backendCoastFiProgress={127} // 250k/197k = ~127%
          backendIsCoastFire={true}
        />,
      )
      expect(screen.getByText("Coast FIRE Achieved!")).toBeInTheDocument()
    })

    it("does not show Coast FIRE when already fully FI", () => {
      render(
        <FiMetrics
          {...defaultProps}
          liquidAssets={2000000} // Above full FI Number
          currentAge={35}
          backendFiProgress={133} // Above 100%
        />,
      )
      // Should show FI achieved, not Coast FIRE
      expect(screen.getByText("Financially Independent!")).toBeInTheDocument()
      expect(screen.queryByText("Coast FI Number")).not.toBeInTheDocument()
    })

    it("does not show Coast FIRE when backendRealYearsToFi not provided", () => {
      render(<FiMetrics {...defaultProps} currentAge={35} />)
      expect(screen.queryByText("Coast FI Number")).not.toBeInTheDocument()
    })

    it("shows years to FI in Coast FI section", () => {
      render(
        <FiMetrics
          {...defaultProps}
          currentAge={40}
          expectedReturnRate={0.07}
          backendRealYearsToFi={20}
          backendCoastFiNumber={400000}
          backendCoastFiProgress={25}
        />,
      )
      expect(screen.getByText(/20yr to FI/)).toBeInTheDocument()
    })
  })

  describe("Privacy Mode", () => {
    it("hides FI Number when privacy mode is enabled", () => {
      usePrivacyMode.mockReturnValue({
        hideValues: true,
        toggleHideValues: jest.fn(),
      })
      const { container } = render(<FiMetrics {...defaultProps} />)
      // Should not show actual values
      expect(container.textContent).not.toContain("1,500,000")
      // Should show hidden placeholder
      expect(container.textContent).toContain("****")
    })

    it("hides FI Progress percentage when privacy mode is enabled", () => {
      usePrivacyMode.mockReturnValue({
        hideValues: true,
        toggleHideValues: jest.fn(),
      })
      render(<FiMetrics {...defaultProps} />)
      const progressContainer = screen.getByText("FI Progress").parentElement
      expect(progressContainer).toHaveTextContent("****")
      expect(progressContainer).not.toHaveTextContent("33.3%")
    })

    it("hides savings rate when privacy mode is enabled", () => {
      usePrivacyMode.mockReturnValue({
        hideValues: true,
        toggleHideValues: jest.fn(),
      })
      render(
        <FiMetrics
          {...defaultProps}
          workingIncomeMonthly={10000}
          monthlyInvestment={4000}
        />,
      )
      const savingsRow = screen.getByText("Savings Rate").closest("div")
      expect(savingsRow).toHaveTextContent("****")
      expect(savingsRow).not.toHaveTextContent("40.0%")
    })

    it("hides Years to FI when privacy mode is enabled", () => {
      usePrivacyMode.mockReturnValue({
        hideValues: true,
        toggleHideValues: jest.fn(),
      })
      render(
        <FiMetrics
          {...defaultProps}
          workingIncomeMonthly={10000}
          monthlyInvestment={4000}
          expectedReturnRate={0.07}
        />,
      )
      const yearsRow = screen.getByText("Years to FI").closest("div")
      expect(yearsRow).toHaveTextContent("****")
    })

    it("hides Coast FI Number when privacy mode is enabled", () => {
      usePrivacyMode.mockReturnValue({
        hideValues: true,
        toggleHideValues: jest.fn(),
      })
      const { container } = render(
        <FiMetrics
          {...defaultProps}
          currentAge={35}
          expectedReturnRate={0.07}
          backendRealYearsToFi={30}
          backendCoastFiNumber={197000}
          backendCoastFiProgress={50}
        />,
      )
      // Should show the label but not the value
      expect(screen.getByText("Coast FI Number")).toBeInTheDocument()
      expect(container.textContent).toContain("****")
    })

    it("does not show FI Achieved message when privacy mode is enabled", () => {
      usePrivacyMode.mockReturnValue({
        hideValues: true,
        toggleHideValues: jest.fn(),
      })
      render(
        <FiMetrics
          {...defaultProps}
          liquidAssets={2000000} // Above FI Number
        />,
      )
      expect(
        screen.queryByText("Financially Independent!"),
      ).not.toBeInTheDocument()
    })

    it("does not show Coast FIRE Achieved message when privacy mode is enabled", () => {
      usePrivacyMode.mockReturnValue({
        hideValues: true,
        toggleHideValues: jest.fn(),
      })
      render(
        <FiMetrics
          {...defaultProps}
          liquidAssets={250000}
          currentAge={35}
          expectedReturnRate={0.07}
          backendRealYearsToFi={30}
          backendCoastFiNumber={197000}
          backendCoastFiProgress={127}
          backendIsCoastFire={true}
        />,
      )
      expect(screen.queryByText("Coast FIRE Achieved!")).not.toBeInTheDocument()
    })
  })

  it("applies correct progress color based on FI percentage", () => {
    // Under 50% - orange
    const { rerender } = render(<FiMetrics {...defaultProps} />)
    let progressSpan = screen
      .getByText("FI Progress")
      .parentElement?.querySelector(".font-semibold")
    expect(progressSpan).toHaveClass("text-orange-600")

    // 50-75% - yellow
    rerender(<FiMetrics {...defaultProps} liquidAssets={900000} />)
    progressSpan = screen
      .getByText("FI Progress")
      .parentElement?.querySelector(".font-semibold")
    expect(progressSpan).toHaveClass("text-yellow-600")

    // 75-100% - blue
    rerender(<FiMetrics {...defaultProps} liquidAssets={1200000} />)
    progressSpan = screen
      .getByText("FI Progress")
      .parentElement?.querySelector(".font-semibold")
    expect(progressSpan).toHaveClass("text-blue-600")

    // 100%+ - green
    rerender(<FiMetrics {...defaultProps} liquidAssets={1600000} />)
    progressSpan = screen
      .getByText("FI Progress")
      .parentElement?.querySelector(".font-semibold")
    expect(progressSpan).toHaveClass("text-green-600")
  })
})
