import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import EditPlanDetailsModal from "../EditPlanDetailsModal"
import { RetirementPlan } from "types/independence"
import useSWR from "swr"

jest.mock("swr", () => ({
  __esModule: true,
  default: jest.fn(),
  mutate: jest.fn(),
  SWRConfig: ({ children }: { children: React.ReactNode }) => children,
}))

const mockedUseSWR = useSWR as jest.MockedFunction<typeof useSWR>

const emptySwrReturn = {
  data: { data: [] },
  error: undefined,
  isLoading: false,
  mutate: jest.fn(),
} as any

jest.mock("@utils/assets/usePrivateAssetConfigs", () => ({
  usePrivateAssetConfigs: () => ({
    configs: [],
    assetNames: {},
    isLoading: false,
  }),
}))

const mockPlan: RetirementPlan = {
  id: "test-plan-1",
  name: "Test Plan",
  yearOfBirth: 1980,
  lifeExpectancy: 90,
  planningHorizonYears: 25,
  monthlyExpenses: 5000,
  expensesCurrency: "NZD",
  pensionMonthly: 1000,
  socialSecurityMonthly: 500,
  otherIncomeMonthly: 200,
  workingIncomeMonthly: 8000,
  workingExpensesMonthly: 6000,
  taxesMonthly: 1500,
  bonusMonthly: 500,
  investmentAllocationPercent: 0.8,
  cashReturnRate: 0.03,
  equityReturnRate: 0.07,
  housingReturnRate: 0.04,
  inflationRate: 0.025,
  cashAllocation: 0.3,
  equityAllocation: 0.5,
  housingAllocation: 0.2,
  targetBalance: 100000,
  ownerId: "test-owner",
  isPrimary: false,
  createdDate: "2024-01-01",
  updatedDate: "2024-01-01",
}

describe("EditPlanDetailsModal", () => {
  const defaultProps = {
    onClose: jest.fn(),
    onApply: jest.fn(),
    plan: mockPlan,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockedUseSWR.mockReturnValue(emptySwrReturn)
  })

  it("renders dialog title when open", () => {
    render(<EditPlanDetailsModal {...defaultProps} />)

    expect(screen.getByText("Edit Plan Details")).toBeInTheDocument()
  })

  it("displays all form fields", () => {
    render(<EditPlanDetailsModal {...defaultProps} />)

    expect(screen.getByText("Pension (Monthly)")).toBeInTheDocument()
    expect(
      screen.getByText("Government Benefits (Monthly)"),
    ).toBeInTheDocument()
    expect(screen.getByText("Start Age")).toBeInTheDocument()
    expect(screen.getByText("Other Income (Monthly)")).toBeInTheDocument()
    expect(screen.getByText("Monthly Expenses")).toBeInTheDocument()
    expect(screen.getByText("Return Rates")).toBeInTheDocument()
    expect(screen.getByText("Asset Allocations")).toBeInTheDocument()
    expect(screen.getByText("Inflation Rate (%)")).toBeInTheDocument()
    expect(screen.getByText("Target Balance (Optional)")).toBeInTheDocument()
  })

  it("initializes form with plan values", () => {
    render(<EditPlanDetailsModal {...defaultProps} />)

    // PrivacyMoneyInput fields remain type="number" (spinbutton)
    const spinbuttons = screen.getAllByRole("spinbutton") as HTMLInputElement[]
    expect(spinbuttons[0]).toHaveValue(1000) // Pension
    expect(spinbuttons[1]).toHaveValue(500) // Government Benefits
    expect(spinbuttons[2]).toHaveValue(200) // Other Income
    expect(spinbuttons[3]).toHaveValue(5000) // Monthly Expenses
    expect(spinbuttons[4]).toHaveValue(100000) // Target Balance

    // Rate/allocation/age fields are now MathInput (type="text" textbox)
    const textboxes = screen.getAllByRole("textbox") as HTMLInputElement[]
    // [0] = benefitsStartAge (empty → "")
    expect(textboxes[0].value).toBe("")
    // [1] = equityReturnRate
    expect(parseFloat(textboxes[1].value)).toBeCloseTo(7, 1)
    // [2] = cashReturnRate
    expect(parseFloat(textboxes[2].value)).toBeCloseTo(3, 1)
    // [3] = housingReturnRate
    expect(parseFloat(textboxes[3].value)).toBeCloseTo(4, 1)
    // [4] = equityAllocation
    expect(parseFloat(textboxes[4].value)).toBeCloseTo(50, 1)
    // [5] = cashAllocation
    expect(parseFloat(textboxes[5].value)).toBeCloseTo(30, 1)
    // [6] = housingAllocation
    expect(parseFloat(textboxes[6].value)).toBeCloseTo(20, 1)
    // [7] = inflationRate
    expect(parseFloat(textboxes[7].value)).toBeCloseTo(2.5, 1)
  })

  it("displays net monthly need calculation", () => {
    render(<EditPlanDetailsModal {...defaultProps} />)

    expect(screen.getByText("Net Monthly Need")).toBeInTheDocument()
    // $5000 - $1000 - $500 - $200 = $3,300
    expect(screen.getByText("$3,300")).toBeInTheDocument()
  })

  it("updates net monthly need when income changes", () => {
    render(<EditPlanDetailsModal {...defaultProps} />)

    const pensionInput = screen.getAllByRole("spinbutton")[0]
    fireEvent.change(pensionInput, { target: { value: "2000" } })

    // $5000 - $2000 - $500 - $200 = $2,300
    expect(screen.getByText("$2,300")).toBeInTheDocument()
  })

  it("calls onClose when cancel button is clicked", () => {
    render(<EditPlanDetailsModal {...defaultProps} />)

    const cancelButton = screen.getByText("Cancel")
    fireEvent.click(cancelButton)

    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it("calls onApply with updated values when apply is clicked", () => {
    render(<EditPlanDetailsModal {...defaultProps} />)

    // Change pension value
    const pensionInput = screen.getAllByRole("spinbutton")[0]
    fireEvent.change(pensionInput, { target: { value: "1500" } })

    // Click apply
    const applyButton = screen.getByText("Apply")
    fireEvent.click(applyButton)

    expect(defaultProps.onApply).toHaveBeenCalledWith({
      pensionMonthly: 1500,
      socialSecurityMonthly: 500,
      benefitsStartAge: undefined,
      otherIncomeMonthly: 200,
      monthlyExpenses: 5000,
      equityReturnRate: 0.07, // Converted back to decimal
      cashReturnRate: 0.03,
      housingReturnRate: 0.04,
      equityAllocation: 0.5, // Converted back to decimal
      cashAllocation: 0.3,
      housingAllocation: 0.2,
      inflationRate: 0.025,
      targetBalance: 100000,
      excludedPortfolioIds: [],
      excludedRentalAssetIds: [],
    })
  })

  it("converts inflation rate from percentage to decimal on apply", () => {
    render(<EditPlanDetailsModal {...defaultProps} />)

    // inflationRate is now a textbox (MathInput) at index 7
    const inflationInput = screen.getAllByRole("textbox")[7]
    fireEvent.change(inflationInput, { target: { value: "3.5" } })

    const applyButton = screen.getByText("Apply")
    fireEvent.click(applyButton)

    expect(defaultProps.onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        inflationRate: 0.035,
      }),
    )
  })

  it("sets targetBalance to undefined when empty", () => {
    render(<EditPlanDetailsModal {...defaultProps} />)

    // targetBalance is still a PrivacyMoneyInput (spinbutton) at index 4
    const targetInput = screen.getAllByRole("spinbutton")[4]
    fireEvent.change(targetInput, { target: { value: "" } })

    const applyButton = screen.getByText("Apply")
    fireEvent.click(applyButton)

    expect(defaultProps.onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        targetBalance: undefined,
      }),
    )
  })

  it("shows description for target balance", () => {
    render(<EditPlanDetailsModal {...defaultProps} />)

    expect(
      screen.getByText("Minimum balance to maintain at end of life"),
    ).toBeInTheDocument()
  })

  it("shows note about saving", () => {
    render(<EditPlanDetailsModal {...defaultProps} />)

    expect(screen.getByText(/Use Save to persist/)).toBeInTheDocument()
  })

  it("reinitializes form when plan changes via remount", () => {
    const updatedPlan = {
      ...mockPlan,
      pensionMonthly: 2000,
      updatedDate: "2026-04-01",
    }

    // In production, modal remounts via key={planVersion} after save
    render(<EditPlanDetailsModal {...defaultProps} plan={updatedPlan} />)

    const inputs = screen.getAllByRole("spinbutton")
    expect(inputs[0]).toHaveValue(2000)
  })

  it("Use Actual button normalizes CPF-polluted allocation to 100%", async () => {
    // Provide an active portfolio so the button renders
    mockedUseSWR.mockReturnValue({
      data: {
        data: [{ id: "p1", code: "MY", name: "My Portfolio", active: true }],
      },
      error: undefined,
      isLoading: false,
      mutate: jest.fn(),
    } as any)

    // Allocation response: equity=42, cash=18, housing=10 → sum 70 (CPF=30%)
    // Expected normalized: equity=60, cash=26, housing=14
    global.fetch = jest.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({
          data: {
            cashAllocation: 18,
            equityAllocation: 42,
            housingAllocation: 10,
          },
        }),
    }) as jest.Mock

    render(<EditPlanDetailsModal {...defaultProps} />)

    const useActualBtn = screen.getByRole("button", { name: /use actual/i })
    fireEvent.click(useActualBtn)

    await waitFor(() => {
      const textboxes = screen.getAllByRole("textbox") as HTMLInputElement[]
      expect(parseFloat(textboxes[4].value)).toBe(60) // equityAllocation
      expect(parseFloat(textboxes[5].value)).toBe(26) // cashAllocation
      expect(parseFloat(textboxes[6].value)).toBe(14) // housingAllocation
    })
  })
})
