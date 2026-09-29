import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import JourneyStageInsights from "@components/features/independence/report/JourneyStageInsights"
import { makeReportProjection } from "@lib/independence/report/__fixtures__/reportProjection"
import type { RetirementPlan, RetirementProjection } from "types/independence"

let mockProjection: RetirementProjection | null = null
let mockLoading = false
let mockError: Error | undefined
const mockProjectionArgs = jest.fn()

jest.mock("@components/features/independence/useUnifiedProjection", () => ({
  useFiProjectionSimple: (args: unknown) => {
    mockProjectionArgs(args)
    return {
      projection: mockProjection,
      isLoading: mockLoading,
      error: mockError,
    }
  },
}))
jest.mock("@components/features/independence/usePlanExpenses", () => ({
  usePlanExpenses: () => ({ expenses: [], isLoading: false }),
}))
jest.mock("@components/features/independence/useExpenseCategories", () => ({
  useExpenseCategories: () => ({ labels: [], isLoading: false }),
}))
jest.mock("@components/features/independence/useLifestyleCatalog", () => ({
  useLifestyleCatalog: () => ({ catalog: null }),
}))

const plan = {
  id: "p-nz",
  name: "New Zealand",
  expensesCurrency: "NZD",
} as RetirementPlan
const props = {
  plan,
  stageLabel: "Stage 2 · New Zealand · ages 70–79",
  assets: {
    liquidAssets: 1_200_000,
    nonSpendableAssets: 500_000,
    totalAssets: 1_700_000,
    hasAssets: true,
    isLoaded: true,
  },
  displayCurrency: "SGD",
  hideValues: false,
}

describe("JourneyStageInsights", () => {
  beforeEach(() => {
    mockProjection = makeReportProjection()
    mockLoading = false
    mockError = undefined
    mockProjectionArgs.mockClear()
  })

  it("should project the stage's own plan in the journey's display currency", () => {
    render(<JourneyStageInsights {...props} />)
    expect(mockProjectionArgs).toHaveBeenCalledWith(
      expect.objectContaining({ plan, displayCurrency: "SGD" }),
    )
  })

  it("should head the block with the stage label and say it is standalone", () => {
    render(<JourneyStageInsights {...props} />)
    const block = screen.getByTestId("stage-p-nz")
    expect(block).toHaveTextContent("Stage 2 · New Zealand · ages 70–79")
    expect(block).toHaveTextContent("Run as a plan on its own")
  })

  it("should list the stage's findings", () => {
    render(<JourneyStageInsights {...props} />)
    expect(screen.getByTestId("stage-p-nz")).toHaveTextContent(
      "On track for independence at 60",
    )
  })

  it("should say so while the stage is still projecting", () => {
    mockProjection = null
    mockLoading = true
    render(<JourneyStageInsights {...props} />)
    expect(screen.getByTestId("stage-p-nz")).toHaveTextContent(
      "Projecting this stage",
    )
  })

  it("should say so when the stage projection failed", () => {
    mockProjection = null
    mockError = new Error("Failed to fetch projection")
    render(<JourneyStageInsights {...props} />)
    expect(screen.getByTestId("stage-p-nz")).toHaveTextContent(
      "This stage could not be projected: Failed to fetch projection",
    )
  })
})
