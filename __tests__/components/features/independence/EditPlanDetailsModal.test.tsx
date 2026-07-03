import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import EditPlanDetailsModal from "@components/features/independence/EditPlanDetailsModal"

jest.mock("swr", () => {
  const mockUseSwr = jest.fn(() => ({ data: { data: [] } }))
  mockUseSwr.default = mockUseSwr
  return mockUseSwr
})
jest.mock("@hooks/usePrivacyMode", () => ({
  usePrivacyMode: () => ({ hideValues: false }),
}))
jest.mock("@utils/assets/usePrivateAssetConfigs", () => ({
  usePrivateAssetConfigs: () => ({ configs: [], assetNames: {} }),
}))
jest.mock("@hooks/useExcludedAssetIds", () => ({
  useExcludedAssetIds: () => new Set(),
}))
jest.mock("@utils/api/fetchHelper", () => ({
  portfoliosKey: "/api/portfolios",
  simpleFetcher: () => jest.fn(),
}))
jest.mock("@lib/independence/planHelpers", () => ({
  parseExcludedPortfolioIds: () => [],
  parseExcludedRentalAssetIds: () => [],
  normalizeAllocation: (e: number, c: number, h: number) => ({
    equity: e,
    cash: c,
    housing: h,
  }),
}))
jest.mock("@components/ui/MathInput", () => ({
  __esModule: true,
  default: ({ onChange, value, ...rest }: any) => (
    <input
      type="number"
      value={value ?? ""}
      onChange={(e) => onChange(Number(e.target.value))}
      {...rest}
    />
  ),
}))

const plan = {
  id: "plan1",
  pensionMonthly: 0,
  socialSecurityMonthly: 0,
  benefitsStartAge: undefined,
  otherIncomeMonthly: 0,
  monthlyExpenses: 3000,
  equityReturnRate: 0.07,
  cashReturnRate: 0.03,
  housingReturnRate: 0.04,
  equityAllocation: 0.6,
  cashAllocation: 0.2,
  housingAllocation: 0.2,
  inflationRate: 0.03,
  targetBalance: 0,
  excludedPortfolioIds: undefined,
  excludedRentalAssetIds: undefined,
}

describe("EditPlanDetailsModal", () => {
  it("renders the Edit Plan Details title", () => {
    render(
      <EditPlanDetailsModal
        onClose={jest.fn()}
        onApply={jest.fn()}
        plan={plan as any}
      />,
    )
    expect(screen.getByText("Edit Plan Details")).toBeInTheDocument()
  })

  it("calls onClose on Escape", () => {
    const onClose = jest.fn()
    render(
      <EditPlanDetailsModal
        onClose={onClose}
        onApply={jest.fn()}
        plan={plan as any}
      />,
    )
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onClose).toHaveBeenCalled()
  })
})
