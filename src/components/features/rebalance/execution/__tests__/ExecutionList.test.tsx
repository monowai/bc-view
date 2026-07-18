import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import { ExecutionSummaryDto } from "types/rebalance"

const mockPush = jest.fn()
jest.mock("next/router", () => ({
  useRouter: () => ({ push: mockPush }),
}))

const mockUseExecutions: {
  executions: ExecutionSummaryDto[]
  isLoading: boolean
  error: Error | undefined
} = {
  executions: [],
  isLoading: false,
  error: undefined,
}
jest.mock("../../hooks/useExecutions", () => ({
  useExecutions: () => mockUseExecutions,
}))

import ExecutionList from "../ExecutionList"

// Spread `overrides` last so an explicit `null` (nullable AD_HOC fields) wins
// over the default — `??`-per-field would collapse an explicit null back to
// the default since `??` treats null as "use the fallback".
const makeSummary = (
  overrides: Partial<ExecutionSummaryDto> = {},
): ExecutionSummaryDto => ({
  id: "exec-1",
  planId: "plan-1",
  planVersion: 2,
  modelId: "model-1",
  modelName: "Growth Model",
  name: undefined,
  portfolioCount: 1,
  status: "DRAFT",
  mode: "REBALANCE",
  snapshotTotalValue: 10000,
  currency: "USD",
  createdAt: "2025-01-01",
  updatedAt: "2025-01-01",
  ...overrides,
})

describe("ExecutionList — ad-hoc (null plan/model) rendering", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders 'Ad-hoc' model column and 'Ad-hoc Rebalance' title when modelName is null", () => {
    mockUseExecutions.executions = [
      makeSummary({
        id: "adhoc-1",
        planId: null,
        planVersion: null,
        modelId: null,
        modelName: null,
        name: undefined,
      }),
    ]

    render(<ExecutionList />)

    expect(screen.getByText("Ad-hoc Rebalance")).toBeInTheDocument()
    expect(screen.getByText("Ad-hoc")).toBeInTheDocument()
  })

  it("still renders model-based executions with plan version and model name", () => {
    mockUseExecutions.executions = [makeSummary()]

    render(<ExecutionList />)

    expect(screen.getByText("Plan v2")).toBeInTheDocument()
    expect(screen.getByText("Growth Model")).toBeInTheDocument()
  })
})
