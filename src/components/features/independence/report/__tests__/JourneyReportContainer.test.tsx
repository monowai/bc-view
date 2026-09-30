import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import JourneyReportContainer from "@components/features/independence/report/JourneyReportContainer"
import { makeJourneyProjection } from "@lib/independence/report/__fixtures__/journeyProjection"
import { reportSeed } from "@lib/independence/report/reportSeed"
import type {
  CompositePhase,
  CompositeProjectionResult,
  RetirementPlan,
} from "types/independence"

const mockRun = jest.fn().mockResolvedValue(undefined)
let mockProjection: CompositeProjectionResult | undefined
let mockSettled = true
let mockError: string | null = null
let mockPhases: CompositePhase[] = []

jest.mock("@hooks/useCompositeProjection", () => ({
  useCompositeProjection: () => ({
    phases: mockPhases,
    setPhases: jest.fn(),
    displayCurrency: "SGD",
    setDisplayCurrency: jest.fn(),
    excludedPlanIds: new Set(),
    toggleExclusion: jest.fn(),
    compositeWorkScenarioId: undefined,
    setCompositeWorkScenarioId: jest.fn(),
    refreshProjection: jest.fn(),
    currentAge: 52,
    projection: mockProjection,
    scenarios: undefined,
    isLoading: !mockSettled,
    isSettled: mockSettled,
    error: mockError,
  }),
}))
jest.mock("@hooks/useCompositeMonteCarloSimulation", () => ({
  useCompositeMonteCarloSimulation: () => ({
    result: null,
    isRunning: false,
    error: null,
    runSimulation: mockRun,
  }),
}))
const mockReport = jest.fn()
jest.mock("@components/features/independence/report/JourneyReport", () => ({
  __esModule: true,
  default: (props: { seed: number; stagePlans: RetirementPlan[] }) => {
    mockReport(props)
    return <div data-testid="journey-report" />
  },
}))

const plans = [
  { id: "p-sg", name: "Singapore" },
  { id: "p-nz", name: "New Zealand" },
  { id: "p-th", name: "Thailand" },
] as RetirementPlan[]
const props = {
  journeyId: "jrn-1",
  journeyName: "Slow travel",
  plans,
  settings: undefined,
  assets: {
    liquidAssets: 1_200_000,
    nonSpendableAssets: 500_000,
    totalAssets: 1_700_000,
    hasAssets: true,
    isLoaded: true,
  },
  hideValues: false,
}

describe("JourneyReportContainer", () => {
  beforeEach(() => {
    mockRun.mockClear()
    mockReport.mockClear()
    mockProjection = makeJourneyProjection()
    mockSettled = true
    mockError = null
    mockPhases = [
      { planId: "p-sg", fromAge: 60, toAge: 69 },
      { planId: "p-nz", fromAge: 70, toAge: 79 },
      { planId: "p-th", fromAge: 80, toAge: 90 },
    ]
  })

  it("should run one seeded composite simulation for the journey", () => {
    render(<JourneyReportContainer {...props} />)
    expect(mockRun).toHaveBeenCalledTimes(1)
    expect(mockRun).toHaveBeenCalledWith({
      iterations: 1000,
      phases: mockPhases,
      displayCurrency: "SGD",
      seed: reportSeed("jrn-1", "2026-09-29"),
    })
  })

  it("should not re-run when the parent re-renders with equal inputs", () => {
    const { rerender } = render(<JourneyReportContainer {...props} />)
    mockPhases = mockPhases.map((p) => ({ ...p }))
    rerender(<JourneyReportContainer {...props} hideValues />)
    expect(mockRun).toHaveBeenCalledTimes(1)
  })

  it("should hand the report each stage's plan in journey order", () => {
    render(<JourneyReportContainer {...props} plans={[...plans].reverse()} />)
    const { stagePlans, seed } = mockReport.mock.calls[0][0]
    expect(stagePlans.map((p: RetirementPlan) => p.id)).toEqual([
      "p-sg",
      "p-nz",
      "p-th",
    ])
    expect(seed).toBe(reportSeed("jrn-1", "2026-09-29"))
  })

  it("should wait for the projection before rendering or simulating", () => {
    mockSettled = false
    mockProjection = undefined
    render(<JourneyReportContainer {...props} />)
    expect(screen.getByText("Preparing report...")).toBeInTheDocument()
    expect(mockRun).not.toHaveBeenCalled()
  })

  it("should show the projection error instead of an empty report", () => {
    mockProjection = undefined
    mockError = "Composite projection failed"
    render(<JourneyReportContainer {...props} />)
    expect(screen.getByText(/Composite projection failed/)).toBeInTheDocument()
    expect(screen.queryByTestId("journey-report")).not.toBeInTheDocument()
  })
})
