import React from "react"
import { render, screen } from "@testing-library/react"
import PlanDetailPage from "@pages/rebalance/models/[modelId]/plans/[planId]"
import { useModel } from "@components/features/rebalance/hooks/useModel"
import { useModelPlan } from "@components/features/rebalance/hooks/useModelPlan"
import { useModelPlans } from "@components/features/rebalance/hooks/useModelPlans"
import type { PlanDto, ModelDto, PlanAssetDto } from "types/rebalance"

// --- Mocks ---

jest.mock("@components/features/rebalance/hooks/useModel")
jest.mock("@components/features/rebalance/hooks/useModelPlan")
jest.mock("@components/features/rebalance/hooks/useModelPlans")

const mockUseModel = useModel as jest.Mock
const mockUseModelPlan = useModelPlan as jest.Mock
const mockUseModelPlans = useModelPlans as jest.Mock

jest.mock("next/router", () => ({
  useRouter: () => ({
    isReady: true,
    query: { modelId: "model-1", planId: "plan-1" },
    push: jest.fn(),
    replace: jest.fn(),
  }),
}))

// --- Fixtures ---

function makeAsset(overrides: Partial<PlanAssetDto> = {}): PlanAssetDto {
  return {
    id: "pa-1",
    assetId: "a1",
    assetCode: "US:VOO",
    assetName: "Vanguard 500",
    weight: 0.5,
    sortOrder: 0,
    ...overrides,
  }
}

function makePlan(overrides: Partial<PlanDto> = {}): PlanDto {
  return {
    id: "plan-1",
    modelId: "model-1",
    modelName: "Test Model",
    version: 1,
    status: "DRAFT",
    assets: [makeAsset()],
    cashWeight: 0,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  }
}

const mockModel: ModelDto = {
  id: "model-1",
  name: "Test Model",
  baseCurrency: "USD",
  risk: 3,
  shared: false,
  isOwner: true,
  planCount: 1,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
}

describe("PlanDetailPage — Approve gate on weight totals", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseModel.mockReturnValue({ model: mockModel })
    mockUseModelPlans.mockReturnValue({ plans: [] })
  })

  it("disables Approve and shows the actual total when weights don't sum to 100%", () => {
    mockUseModelPlan.mockReturnValue({
      plan: makePlan({
        assets: [
          makeAsset({ assetId: "a1", weight: 0.5 }),
          // 0.5 + 0.465 = 0.965 -> 96.50%, not 100%.
          makeAsset({ assetId: "a2", assetCode: "US:VXUS", weight: 0.465 }),
        ],
      }),
      isLoading: false,
      error: undefined,
      mutate: jest.fn(),
    })
    render(<PlanDetailPage />)

    const approveButton = screen.getByRole("button", { name: /Approve Plan/i })
    expect(approveButton).toBeDisabled()
    expect(
      screen.getByText("Weights total 96.50% — must equal 100% to approve"),
    ).toBeInTheDocument()
  })

  it("enables Approve once weights sum to exactly 100%, with no warning message", () => {
    mockUseModelPlan.mockReturnValue({
      plan: makePlan({
        assets: [
          makeAsset({ assetId: "a1", weight: 0.6 }),
          makeAsset({ assetId: "a2", assetCode: "US:VXUS", weight: 0.4 }),
        ],
      }),
      isLoading: false,
      error: undefined,
      mutate: jest.fn(),
    })
    render(<PlanDetailPage />)

    const approveButton = screen.getByRole("button", { name: /Approve Plan/i })
    expect(approveButton).not.toBeDisabled()
    expect(
      screen.queryByText(/must equal 100% to approve/i),
    ).not.toBeInTheDocument()
  })

  it("still disables Approve when there are no assets at all (unaffected by the new gate)", () => {
    mockUseModelPlan.mockReturnValue({
      plan: makePlan({ assets: [] }),
      isLoading: false,
      error: undefined,
      mutate: jest.fn(),
    })
    render(<PlanDetailPage />)

    const approveButton = screen.getByRole("button", { name: /Approve Plan/i })
    expect(approveButton).toBeDisabled()
    // No misleading "total" message when there's nothing to total.
    expect(
      screen.queryByText(/must equal 100% to approve/i),
    ).not.toBeInTheDocument()
  })
})
