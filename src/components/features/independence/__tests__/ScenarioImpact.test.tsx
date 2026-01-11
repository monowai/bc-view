import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import ScenarioImpact from "../ScenarioImpact"
import { DisplayProjection, DEFAULT_WHAT_IF_ADJUSTMENTS } from "../types"

const createMockProjection = (
  overrides: Partial<DisplayProjection> = {},
): DisplayProjection => ({
  planId: "test-plan-1",
  asOfDate: "2024-01-01",
  totalAssets: 700000,
  liquidAssets: 500000,
  monthlyExpenses: 5000,
  currency: "NZD",
  nonSpendableAtRetirement: 200000,
  housingReturnRate: 0.04,
  runwayYears: 25,
  runwayMonths: 300,
  depletionAge: 90,
  yearlyProjections: [
    {
      year: 1,
      age: 65,
      startingBalance: 500000,
      investment: 35000,
      withdrawals: 40000,
      endingBalance: 495000,
      inflationAdjustedExpenses: 60000,
      currency: "NZD",
      nonSpendableValue: 200000,
      totalWealth: 695000,
      propertyLiquidated: false,
    },
    {
      year: 2,
      age: 66,
      startingBalance: 495000,
      investment: 34650,
      withdrawals: 41000,
      endingBalance: 488650,
      inflationAdjustedExpenses: 61500,
      currency: "NZD",
      nonSpendableValue: 208000,
      totalWealth: 696650,
      propertyLiquidated: false,
    },
  ],
  ...overrides,
})

describe("ScenarioImpact", () => {
  const defaultProps = {
    projection: createMockProjection(),
    lifeExpectancy: 90,
    currency: "$",
    whatIfAdjustments: DEFAULT_WHAT_IF_ADJUSTMENTS,
    onLiquidationThresholdChange: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders section title", () => {
    render(<ScenarioImpact {...defaultProps} />)

    expect(screen.getByText("Scenario Impact")).toBeInTheDocument()
  })

  it("shows message when no projection provided", () => {
    render(<ScenarioImpact {...defaultProps} projection={null} />)

    expect(screen.getByText("Calculate a projection first")).toBeInTheDocument()
  })

  it("displays liquid funds last to age when no liquidation", () => {
    render(<ScenarioImpact {...defaultProps} />)

    expect(screen.getByText("Liquid funds last to")).toBeInTheDocument()
    // Multiple "Beyond 90" elements may exist, use getAllByText
    const beyondElements = screen.getAllByText("Beyond 90")
    expect(beyondElements.length).toBeGreaterThanOrEqual(1)
  })

  it("displays liquidation age when property is sold", () => {
    const projectionWithLiquidation = createMockProjection({
      yearlyProjections: [
        ...createMockProjection().yearlyProjections,
        {
          year: 3,
          age: 80,
          startingBalance: 50000,
          investment: 3500,
          withdrawals: 45000,
          endingBalance: 208500,
          inflationAdjustedExpenses: 63000,
          currency: "NZD",
          nonSpendableValue: 0,
          totalWealth: 208500,
          propertyLiquidated: true,
        },
      ],
    })

    render(
      <ScenarioImpact
        {...defaultProps}
        projection={projectionWithLiquidation}
      />,
    )

    expect(screen.getByText("Age 80")).toBeInTheDocument()
  })

  it("shows illiquid funds section when non-spendable assets exist", () => {
    render(<ScenarioImpact {...defaultProps} />)

    expect(screen.getByText("Illiquid funds realise")).toBeInTheDocument()
    expect(screen.getByText("Total wealth lasts to")).toBeInTheDocument()
  })

  it("hides illiquid funds section when no non-spendable assets", () => {
    const projectionNoProperty = createMockProjection({
      yearlyProjections: [
        {
          ...createMockProjection().yearlyProjections[0],
          nonSpendableValue: 0,
        },
      ],
    })

    render(
      <ScenarioImpact {...defaultProps} projection={projectionNoProperty} />,
    )

    expect(screen.queryByText("Illiquid funds realise")).not.toBeInTheDocument()
  })

  it("displays liquidation threshold slider", () => {
    render(<ScenarioImpact {...defaultProps} />)

    expect(screen.getByText("Sell trigger threshold")).toBeInTheDocument()
    expect(screen.getByText("10%")).toBeInTheDocument()
  })

  it("calls onLiquidationThresholdChange when slider changes", () => {
    render(<ScenarioImpact {...defaultProps} />)

    const slider = screen.getByRole("slider")
    fireEvent.change(slider, { target: { value: "20" } })

    expect(defaultProps.onLiquidationThresholdChange).toHaveBeenCalledWith(20)
  })

  it("displays liquid balance at liquidation when available", () => {
    const projectionWithLiquidationBalance = createMockProjection({
      liquidBalanceAtLiquidation: 45000,
      yearlyProjections: [
        ...createMockProjection().yearlyProjections,
        {
          year: 3,
          age: 80,
          startingBalance: 45000,
          investment: 3000,
          withdrawals: 45000,
          endingBalance: 203000,
          inflationAdjustedExpenses: 63000,
          currency: "NZD",
          nonSpendableValue: 0,
          totalWealth: 203000,
          propertyLiquidated: true,
        },
      ],
    })

    render(
      <ScenarioImpact
        {...defaultProps}
        projection={projectionWithLiquidationBalance}
      />,
    )

    expect(screen.getByText("Liquid balance at sale")).toBeInTheDocument()
    expect(screen.getByText("$45,000")).toBeInTheDocument()
  })

  it("shows property sale notice when liquidation occurs", () => {
    const projectionWithLiquidation = createMockProjection({
      yearlyProjections: [
        ...createMockProjection().yearlyProjections,
        {
          year: 3,
          age: 75,
          startingBalance: 50000,
          investment: 3500,
          withdrawals: 45000,
          endingBalance: 208500,
          inflationAdjustedExpenses: 63000,
          currency: "NZD",
          nonSpendableValue: 0,
          totalWealth: 208500,
          propertyLiquidated: true,
        },
      ],
    })

    render(
      <ScenarioImpact
        {...defaultProps}
        projection={projectionWithLiquidation}
      />,
    )

    expect(screen.getByText(/Property sold at age 75/i)).toBeInTheDocument()
  })
})
