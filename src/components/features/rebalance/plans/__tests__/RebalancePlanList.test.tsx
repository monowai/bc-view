import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import { PlanDto } from "types/rebalance"

const mockPush = jest.fn()
jest.mock("next/router", () => ({
  useRouter: () => ({ push: mockPush }),
}))

const mockUseAllPlans: {
  plans: PlanDto[]
  isLoading: boolean
  error: Error | undefined
  mutate: jest.Mock
} = {
  plans: [],
  isLoading: false,
  error: undefined,
  mutate: jest.fn(),
}
jest.mock("../../hooks/useAllPlans", () => ({
  useAllPlans: () => mockUseAllPlans,
}))

import RebalancePlanList from "../RebalancePlanList"

const makePlan = (overrides: Partial<PlanDto> = {}): PlanDto => ({
  id: "plan-1",
  modelId: "model-1",
  modelName: "Growth Model",
  version: 1,
  description: undefined,
  status: "DRAFT",
  assets: [],
  cashWeight: 1,
  createdAt: "2025-01-01",
  approvedAt: undefined,
  updatedAt: "2025-01-01",
  ...overrides,
})

describe("RebalancePlanList — aggregated across models", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseAllPlans.plans = []
    mockUseAllPlans.isLoading = false
    mockUseAllPlans.error = undefined
  })

  it("renders plans aggregated from multiple models", () => {
    mockUseAllPlans.plans = [
      makePlan({ id: "plan-1", modelId: "model-1", modelName: "Growth" }),
      makePlan({ id: "plan-2", modelId: "model-2", modelName: "Income" }),
    ]

    render(<RebalancePlanList />)

    expect(screen.getByText("Growth")).toBeInTheDocument()
    expect(screen.getByText("Income")).toBeInTheDocument()
  })

  it("navigates to the per-model plan detail route on row click, not the orphaned top-level page", () => {
    mockUseAllPlans.plans = [
      makePlan({ id: "plan-1", modelId: "model-1", modelName: "Growth" }),
    ]

    render(<RebalancePlanList />)

    fireEvent.click(screen.getByText("Growth"))

    expect(mockPush).toHaveBeenCalledWith(
      "/rebalance/models/model-1/plans/plan-1",
    )
  })

  it("shows an empty state with a link into the wizard when there are no plans", () => {
    render(<RebalancePlanList />)

    expect(screen.getByText("No rebalance plans yet")).toBeInTheDocument()
  })

  it("shows an error state when the aggregate fetch fails", () => {
    mockUseAllPlans.error = new Error("boom")

    render(<RebalancePlanList />)

    expect(screen.getByText("Failed to load plans")).toBeInTheDocument()
  })
})
