import React from "react"
import { render, screen, within } from "@testing-library/react"
import "@testing-library/jest-dom"
import JourneyReport from "@components/features/independence/report/JourneyReport"
import { makeJourneyProjection } from "@lib/independence/report/__fixtures__/journeyProjection"
import { fixtureMonteCarloResult } from "@components/features/independence/__fixtures__/monteCarloResult"
import type { RetirementPlan } from "types/independence"

// The wealth chart is the journey page's own component, covered by its own
// tests and bound to the composite context; stub it here.
jest.mock("@components/features/independence/composite/WealthOverTime", () => ({
  __esModule: true,
  default: (): React.ReactElement => <div data-testid="wealth-stub" />,
}))
const mockStage = jest.fn()
jest.mock(
  "@components/features/independence/report/JourneyStageInsights",
  () => ({
    __esModule: true,
    default: (props: { plan: RetirementPlan; stageLabel: string }) => {
      mockStage(props)
      return <div data-testid={`stage-insights-${props.plan.id}`} />
    },
  }),
)
jest.mock("recharts", () => {
  const OriginalModule = jest.requireActual("recharts")
  return {
    ...OriginalModule,
    ResponsiveContainer: ({
      children,
    }: {
      children: React.ReactNode
    }): React.ReactElement => (
      <div style={{ width: 800, height: 400 }}>{children}</div>
    ),
  }
})

const stagePlans = [
  { id: "p-sg", name: "Singapore", expensesCurrency: "SGD" },
  { id: "p-nz", name: "New Zealand", expensesCurrency: "NZD" },
  { id: "p-th", name: "Thailand", expensesCurrency: "THB" },
] as RetirementPlan[]

const baseProps = {
  journeyName: "Slow travel",
  projection: makeJourneyProjection(),
  mc: fixtureMonteCarloResult,
  seed: 4213,
  hideValues: false,
  stagePlans,
  assets: {
    liquidAssets: 1_200_000,
    nonSpendableAssets: 500_000,
    totalAssets: 1_700_000,
    hasAssets: true,
    isLoaded: true,
  },
  backHref: "/independence?plan=jrn-1",
}

describe("JourneyReport", () => {
  beforeEach(() => mockStage.mockClear())

  it("should render every section heading in order", () => {
    render(<JourneyReport {...baseProps} />)
    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent)
    expect(headings).toEqual([
      "1. Verdict",
      "2. Where you stand",
      "3. Your journey",
      "4. Stages",
      "5. Stress test",
      "6. Stage by stage",
      "7. Assumptions",
      "8. Appendix",
    ])
  })

  it("should name the journey and its stage count on the cover", () => {
    render(<JourneyReport {...baseProps} />)
    const cover = screen.getByTestId("report-cover")
    expect(cover).toHaveTextContent("Slow travel")
    expect(cover).toHaveTextContent("3 stages")
  })

  it("should list the stages with their ages", () => {
    render(<JourneyReport {...baseProps} />)
    const table = within(screen.getByTestId("report-stages"))
    expect(table.getByText("New Zealand")).toBeInTheDocument()
    expect(table.getByText("70–79")).toBeInTheDocument()
  })

  it("should render one insights block per stage, in journey order", () => {
    render(<JourneyReport {...baseProps} />)
    expect(mockStage.mock.calls.map((c) => c[0].plan.id)).toEqual([
      "p-sg",
      "p-nz",
      "p-th",
    ])
    expect(mockStage.mock.calls[1][0].stageLabel).toBe(
      "Stage 2 · New Zealand · ages 70–79",
    )
  })

  it("should say a stage's plan is missing rather than drop the stage", () => {
    render(<JourneyReport {...baseProps} stagePlans={stagePlans.slice(0, 2)} />)
    expect(screen.getByTestId("report-stage-by-stage")).toHaveTextContent(
      "Thailand: this stage's plan is not available.",
    )
  })

  it("should print the seed in the stress-test section", () => {
    render(<JourneyReport {...baseProps} />)
    expect(screen.getByTestId("report-stress")).toHaveTextContent("4213")
  })

  it("should distinguish a failed stress test from one not run", () => {
    const { rerender } = render(
      <JourneyReport {...baseProps} mc={null} mcError="Boom" />,
    )
    expect(screen.getByTestId("report-stress")).toHaveTextContent(
      "Stress test failed: Boom",
    )
    rerender(<JourneyReport {...baseProps} mc={null} />)
    expect(screen.getByTestId("report-stress")).toHaveTextContent(
      "Stress test not run",
    )
  })

  it("should not print a deterministic runway the composite simulation does not compute", () => {
    render(<JourneyReport {...baseProps} />)
    expect(screen.getByTestId("report-stress")).not.toHaveTextContent(
      "Deterministic runway",
    )
  })

  it("should label pre-independence rows as before independence, not as the first stage", () => {
    render(<JourneyReport {...baseProps} />)
    const firstRow = within(screen.getByTestId("report-appendix")).getAllByRole(
      "row",
    )[1]
    expect(firstRow).toHaveTextContent("52Before independence")
  })

  it("should label each appendix row with its stage", () => {
    render(<JourneyReport {...baseProps} />)
    const appendix = within(screen.getByTestId("report-appendix"))
    expect(appendix.getAllByText("Thailand").length).toBeGreaterThan(0)
  })

  it("should mask money when privacy mode is on", () => {
    render(<JourneyReport {...baseProps} hideValues />)
    expect(screen.getByTestId("report-stages")).not.toHaveTextContent("S$")
    expect(screen.getByTestId("report-appendix")).not.toHaveTextContent("S$1,")
  })

  it("should render the versioned footer", () => {
    render(<JourneyReport {...baseProps} />)
    expect(screen.getByTestId("report-footer")).toHaveTextContent(
      "Slow travel · as of 2026-09-29 · report v0.2",
    )
  })
})
