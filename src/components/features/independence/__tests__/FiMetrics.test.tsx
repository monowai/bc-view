import React from "react"
import { render, screen } from "@testing-library/react"
import type { FiMetrics as FiMetricsType } from "types/independence"
import FiMetrics from "../FiMetrics"

/** Build a minimal FiMetrics fixture for tests; non-required fields default. */
function mkFi(overrides: Partial<FiMetricsType> = {}): FiMetricsType {
  return {
    fiNumber: 0,
    fiProgress: 0,
    gapToFi: 0,
    netMonthlyExpenses: 0,
    totalMonthlyIncome: 0,
    isCoastFire: false,
    isFinanciallyIndependent: false,
    ...overrides,
  }
}

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

  it("renders Retirement Strategies heading", () => {
    render(<FiMetrics {...defaultProps} />)
    expect(screen.getByText("Retirement Strategies")).toBeInTheDocument()
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
    expect(screen.getByText("Early Retirement Progress")).toBeInTheDocument()
    // The percentage is in a span, verify it's present
    const container = screen
      .getByText("Early Retirement Progress")
      .closest(".flex")
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
    const progressContainer = screen
      .getByText("Early Retirement Progress")
      .closest(".flex")
    expect(progressContainer).toHaveTextContent("200.0%")
  })

  it("displays formula breakdown for FI Number", () => {
    render(<FiMetrics {...defaultProps} />)
    // Compact form: "NZD5,000/mo × 12 × 25"
    const formulaText = screen.getByText(/\/mo × 12 × 25/)
    expect(formulaText).toHaveTextContent("5,000")
  })

  it("shows current assets on progress scale", () => {
    render(<FiMetrics {...defaultProps} />)
    // Find the progress bar footer which shows assets range
    const progressSection = screen
      .getByText("Early Retirement Progress")
      .closest("div")
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
    const CURRENT_AGE = 35
    const RETIREMENT_AGE = 65 // yearsToRetirement = 30

    const coastProps = {
      ...defaultProps,
      currentAge: CURRENT_AGE,
      retirementAge: RETIREMENT_AGE,
      expectedReturnRate: 0.07,
      backendFiMetrics: mkFi({ coastFiNumber: 197000, coastFiProgress: 50 }),
    }

    it("calculates Coast FI Number correctly", () => {
      const { container } = render(<FiMetrics {...coastProps} />)
      expect(screen.getByText("Coast FI Number")).toBeInTheDocument()
      expect(container.textContent).toContain("Coast FI Progress")
    })

    it("shows Coast FIRE achieved when assets exceed Coast FI Number", () => {
      render(
        <FiMetrics
          {...coastProps}
          liquidAssets={250000}
          backendFiMetrics={mkFi({
            coastFiNumber: 197000,
            coastFiProgress: 127, // 250k/197k = ~127%
            isCoastFire: true,
          })}
        />,
      )
      expect(screen.getByText("Coast FIRE Achieved!")).toBeInTheDocument()
    })

    it("does not show Coast FIRE when already fully FI", () => {
      render(
        <FiMetrics
          {...coastProps}
          liquidAssets={2000000} // Above full FI Number of 1,500,000
          backendFiMetrics={mkFi({
            coastFiNumber: 197000,
            coastFiProgress: 50,
            fiProgress: 133,
          })}
        />,
      )
      expect(screen.getByText("Financially Independent!")).toBeInTheDocument()
      expect(screen.queryByText("Coast FI Number")).not.toBeInTheDocument()
    })

    it("does not show Coast FIRE when retirementAge not provided", () => {
      render(<FiMetrics {...defaultProps} currentAge={CURRENT_AGE} />)
      expect(screen.queryByText("Coast FI Number")).not.toBeInTheDocument()
    })

    it("shows years to retirement in Coast FI section", () => {
      const age = 40
      const retireAt = 60
      const yearsToRetire = retireAt - age // 20
      render(
        <FiMetrics
          {...defaultProps}
          currentAge={age}
          retirementAge={retireAt}
          expectedReturnRate={0.07}
          backendFiMetrics={mkFi({
            coastFiNumber: 400000,
            coastFiProgress: 25,
          })}
        />,
      )
      expect(
        screen.getByText(
          new RegExp(`${yearsToRetire}yr to retirement, age ${retireAt}`),
        ),
      ).toBeInTheDocument()
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
      const progressContainer = screen
        .getByText("Early Retirement Progress")
        .closest(".flex")
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
          retirementAge={65}
          expectedReturnRate={0.07}
          backendFiMetrics={mkFi({
            coastFiNumber: 197000,
            coastFiProgress: 50,
          })}
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
          retirementAge={65}
          expectedReturnRate={0.07}
          backendFiMetrics={mkFi({
            coastFiNumber: 197000,
            coastFiProgress: 127,
            isCoastFire: true,
          })}
        />,
      )
      expect(screen.queryByText("Coast FIRE Achieved!")).not.toBeInTheDocument()
    })
  })

  it("applies correct progress color based on FI percentage", () => {
    // Under 50% - orange
    const { rerender } = render(<FiMetrics {...defaultProps} />)
    let progressSpan = screen
      .getByText("Early Retirement Progress")
      .closest(".flex")
      ?.querySelector(".font-semibold")
    expect(progressSpan).toHaveClass("text-orange-600")

    // 50-75% - yellow
    rerender(<FiMetrics {...defaultProps} liquidAssets={900000} />)
    progressSpan = screen
      .getByText("Early Retirement Progress")
      .closest(".flex")
      ?.querySelector(".font-semibold")
    expect(progressSpan).toHaveClass("text-yellow-600")

    // 75-100% - blue
    rerender(<FiMetrics {...defaultProps} liquidAssets={1200000} />)
    progressSpan = screen
      .getByText("Early Retirement Progress")
      .closest(".flex")
      ?.querySelector(".font-semibold")
    expect(progressSpan).toHaveClass("text-blue-600")

    // 100%+ - green
    rerender(<FiMetrics {...defaultProps} liquidAssets={1600000} />)
    progressSpan = screen
      .getByText("Early Retirement Progress")
      .closest(".flex")
      ?.querySelector(".font-semibold")
    expect(progressSpan).toHaveClass("text-green-600")
  })

  describe("Retirement Strategies", () => {
    const rubyPensionProps = {
      ...defaultProps,
      backendFiMetrics: mkFi({
        retirementAgeFiProgress: 54.0,
        bridgeYears: 3.33,
        bridgeYearsNeeded: 13,
        bridgeProgress: 25.64,
        incomeCoverageAtRetirement: 44.44,
      }),
    }

    it("always renders the FIRE Strategy section", () => {
      render(<FiMetrics {...defaultProps} />)
      expect(screen.getByText("FIRE Strategy")).toBeInTheDocument()
    })

    it("renders Pension + Bridge sections for a pension saver", () => {
      render(<FiMetrics {...rubyPensionProps} />)
      expect(screen.getByText("Pension Strategy")).toBeInTheDocument()
      expect(screen.getByText("Bridge Strategy")).toBeInTheDocument()
      expect(screen.getByText("Retirement-Age FI")).toBeInTheDocument()
      expect(screen.getByText("Income Coverage")).toBeInTheDocument()
      expect(screen.getByText("Bridge to Pension")).toBeInTheDocument()
    })

    it("hides Pension + Bridge when no guaranteed income configured", () => {
      render(<FiMetrics {...defaultProps} />)
      expect(screen.queryByText("Pension Strategy")).not.toBeInTheDocument()
      expect(screen.queryByText("Bridge Strategy")).not.toBeInTheDocument()
    })

    it("shows Pension but not Bridge when no years-to-retirement gap", () => {
      // Income coverage present but no bridge data → user is at/past retirement age
      render(
        <FiMetrics
          {...defaultProps}
          backendFiMetrics={mkFi({ incomeCoverageAtRetirement: 70 })}
        />,
      )
      expect(screen.getByText("Pension Strategy")).toBeInTheDocument()
      expect(screen.getByText("Income Coverage")).toBeInTheDocument()
      expect(screen.queryByText("Bridge Strategy")).not.toBeInTheDocument()
    })

    it("formats Retirement-Age FI as a percentage", () => {
      render(<FiMetrics {...rubyPensionProps} />)
      const row = screen
        .getByText("Retirement-Age FI")
        .closest("div")?.parentElement
      expect(row?.textContent).toContain("54.0%")
    })

    it("formats Bridge to Pension as years out of needed", () => {
      render(<FiMetrics {...rubyPensionProps} />)
      const row = screen
        .getByText("Bridge to Pension")
        .closest("div")?.parentElement
      expect(row?.textContent).toContain("3.3 / 13 years")
    })

    it("formats Income Coverage as a percentage", () => {
      render(<FiMetrics {...rubyPensionProps} />)
      const row = screen
        .getByText("Income Coverage")
        .closest("div")?.parentElement
      expect(row?.textContent).toContain("44.4%")
    })

    it("respects privacy mode by hiding values", () => {
      usePrivacyMode.mockReturnValue({
        hideValues: true,
        toggleHideValues: jest.fn(),
      })
      render(<FiMetrics {...rubyPensionProps} />)
      const row = screen
        .getByText("Retirement-Age FI")
        .closest("div")?.parentElement
      expect(row?.textContent).not.toContain("54.0%")
    })

    it("colours Income Coverage green when fully covered", () => {
      render(
        <FiMetrics
          {...defaultProps}
          backendFiMetrics={mkFi({ incomeCoverageAtRetirement: 100 })}
        />,
      )
      const span = screen
        .getByText("Income Coverage")
        .closest("div")
        ?.parentElement?.querySelector(".font-semibold")
      expect(span).toHaveClass("text-green-600")
    })

    it("orders Pension gauges by value descending so best news leads", () => {
      // Ruby: Retirement-Age FI 54 > Income Coverage 44.44
      render(<FiMetrics {...rubyPensionProps} />)
      const pensionHeader = screen.getByText("Pension Strategy")
      const section = pensionHeader.closest(".pt-4")
      const labels = Array.from(
        section?.querySelectorAll("span.text-gray-600") ?? [],
      ).map((el) => el.textContent)
      expect(labels).toEqual(["Retirement-Age FI", "Income Coverage"])
    })

    it("shows retirement-age FI banner inside Pension section", () => {
      render(
        <FiMetrics
          {...defaultProps}
          backendFiMetrics={mkFi({ retirementAgeFiProgress: 100 })}
        />,
      )
      expect(
        screen.getByText("On Track for FI at Retirement"),
      ).toBeInTheDocument()
    })

    it("shows Active badge on FIRE Strategy when effective strategy is FIRE", () => {
      render(<FiMetrics {...defaultProps} effectiveStrategy="FIRE" />)
      const header = screen.getByText("FIRE Strategy")
      const row = header.closest(".justify-between")
      expect(row?.textContent).toContain("Active")
    })

    it("shows Active badge on Pension Strategy when effective strategy is PENSION", () => {
      render(<FiMetrics {...rubyPensionProps} effectiveStrategy="PENSION" />)
      const header = screen.getByText("Pension Strategy")
      const row = header.closest(".justify-between")
      expect(row?.textContent).toContain("Active")
    })

    it("shows Active badge on Bridge Strategy when effective strategy is HYBRID", () => {
      render(<FiMetrics {...rubyPensionProps} effectiveStrategy="HYBRID" />)
      const header = screen.getByText("Bridge Strategy")
      const row = header.closest(".justify-between")
      expect(row?.textContent).toContain("Active")
    })

    it("does not show Active badge when effectiveStrategy is undefined", () => {
      const { container } = render(<FiMetrics {...rubyPensionProps} />)
      expect(container.textContent).not.toContain("Active")
    })

    it("view=ALL shows every section regardless of eligibility", () => {
      render(<FiMetrics {...rubyPensionProps} view="ALL" />)
      expect(screen.getByText("FIRE Strategy")).toBeInTheDocument()
      expect(screen.getByText("Pension Strategy")).toBeInTheDocument()
      expect(screen.getByText("Bridge Strategy")).toBeInTheDocument()
    })

    it("view=FIRE hides Pension + Bridge for Ruby", () => {
      render(<FiMetrics {...rubyPensionProps} view="FIRE" />)
      expect(screen.getByText("FIRE Strategy")).toBeInTheDocument()
      expect(screen.queryByText("Pension Strategy")).not.toBeInTheDocument()
      expect(screen.queryByText("Bridge Strategy")).not.toBeInTheDocument()
    })

    it("view=PENSION hides FIRE + Bridge for Ruby", () => {
      render(<FiMetrics {...rubyPensionProps} view="PENSION" />)
      expect(screen.queryByText("FIRE Strategy")).not.toBeInTheDocument()
      expect(screen.getByText("Pension Strategy")).toBeInTheDocument()
      expect(screen.queryByText("Bridge Strategy")).not.toBeInTheDocument()
    })

    it("view=HYBRID hides FIRE + Pension for Ruby", () => {
      render(<FiMetrics {...rubyPensionProps} view="HYBRID" />)
      expect(screen.queryByText("FIRE Strategy")).not.toBeInTheDocument()
      expect(screen.queryByText("Pension Strategy")).not.toBeInTheDocument()
      expect(screen.getByText("Bridge Strategy")).toBeInTheDocument()
    })

    it("view defaults to ALL when omitted (plain FIRE user shows FIRE only)", () => {
      render(<FiMetrics {...defaultProps} />)
      expect(screen.getByText("FIRE Strategy")).toBeInTheDocument()
      // No backend pension/bridge data → those sections still hidden.
      expect(screen.queryByText("Pension Strategy")).not.toBeInTheDocument()
      expect(screen.queryByText("Bridge Strategy")).not.toBeInTheDocument()
    })

    it("hides retirement-age FI banner when classic FI already achieved", () => {
      render(
        <FiMetrics
          {...defaultProps}
          liquidAssets={2_000_000}
          backendFiMetrics={mkFi({ retirementAgeFiProgress: 150 })}
        />,
      )
      // Classic banner wins; pension banner stays hidden to avoid duplication
      expect(screen.getByText("Financially Independent!")).toBeInTheDocument()
      expect(
        screen.queryByText("On Track for FI at Retirement"),
      ).not.toBeInTheDocument()
    })
  })
})
