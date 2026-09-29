import React from "react"
import { render, screen, within } from "@testing-library/react"
import "@testing-library/jest-dom"
import IndependenceReport from "@components/features/independence/report/IndependenceReport"
import { makeReportProjection } from "@lib/independence/report/__fixtures__/reportProjection"
import { fixtureMonteCarloResult } from "@components/features/independence/__fixtures__/monteCarloResult"
import type { RetirementPlan } from "types/independence"

// The timeline is the plan page's own component and is covered by its own
// tests; stub it so key/console assertions here are about the report only.
jest.mock("@components/features/independence/TimelineTabContent", () => ({
  __esModule: true,
  default: (): React.ReactElement => <div data-testid="timeline-stub" />,
}))
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

const plan = {
  id: "plan-1",
  name: "Base plan",
  expensesCurrency: "SGD",
} as RetirementPlan

const baseProps = {
  plan,
  projection: makeReportProjection(),
  baselineProjection: null,
  mc: fixtureMonteCarloResult,
  seed: 4213,
  ages: { currentAge: 52, retirementAge: 60, lifeExpectancy: 90 },
  effectiveCurrency: "SGD",
  hideValues: false,
  lifestyle: null,
}

describe("IndependenceReport", () => {
  it("should render every section heading in order", () => {
    render(<IndependenceReport {...baseProps} />)
    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent)
    expect(headings).toEqual([
      "1. Verdict",
      "2. Where you stand",
      "3. Lifestyle",
      "4. Your journey",
      "5. Stress test",
      "6. Insights",
      "7. Assumptions",
      "8. Appendix",
    ])
  })

  it("should lead with the first finding as the headline and the verdict sentence", () => {
    render(<IndependenceReport {...baseProps} />)
    const verdict = screen.getByTestId("report-verdict")
    expect(
      within(verdict).getByText("On track for independence at 60"),
    ).toBeInTheDocument()
    expect(verdict).toHaveTextContent(/funds every year to age 90/)
  })

  it("should print the seed in the stress-test section", () => {
    render(<IndependenceReport {...baseProps} />)
    expect(screen.getByTestId("report-stress")).toHaveTextContent("4213")
  })

  it("should omit the stress-test body and say so when no simulation ran", () => {
    render(<IndependenceReport {...baseProps} mc={null} />)
    expect(screen.getByTestId("report-stress")).toHaveTextContent(/not run/i)
  })

  it("should tag FIRE-lens findings when the strategy is HYBRID", () => {
    render(<IndependenceReport {...baseProps} />)
    const insights = screen.getByTestId("report-insights")
    expect(within(insights).getByText("FIRE lens")).toBeInTheDocument()
  })

  it("should render the milestones in fixed order", () => {
    render(<IndependenceReport {...baseProps} />)
    const items = within(screen.getByTestId("report-milestones"))
      .getAllByRole("listitem")
      .map((li) => li.textContent)
    expect(items[0]).toBe("Independence at age 62.")
    expect(items[items.length - 1]).toMatch(/^Peak wealth/)
  })

  it("should render the versioned footer", () => {
    render(<IndependenceReport {...baseProps} />)
    expect(screen.getByTestId("report-footer")).toHaveTextContent(
      "Base plan · as of 2026-09-28 · report v0.1",
    )
  })

  it("should mask money when privacy mode is on", () => {
    render(<IndependenceReport {...baseProps} hideValues />)
    expect(screen.getByTestId("report-verdict")).not.toHaveTextContent("S$")
  })
})

describe("IndependenceReport currency", () => {
  it("should print the currency symbol, not the ISO code, for money", () => {
    render(<IndependenceReport {...baseProps} effectiveCurrency="SGD" />)
    const verdict = screen.getByTestId("report-verdict")
    expect(verdict.textContent).toContain("S$")
    expect(verdict.textContent).not.toMatch(/SGD\d/)
  })
})

describe("IndependenceReport robustness", () => {
  it("should clamp the progress bar at zero for a negative fiProgress", () => {
    const projection = makeReportProjection()
    projection.fiMetrics = { ...projection.fiMetrics!, fiProgress: -12 }
    render(<IndependenceReport {...baseProps} projection={projection} />)
    const bar = screen.getByTestId("report-fi-bar")
    expect(bar).toHaveStyle({ width: "0%" })
  })

  it("should say the stress test failed when the simulation errored", () => {
    render(
      <IndependenceReport
        {...baseProps}
        mc={null}
        mcError="Failed to run Monte Carlo simulation"
      />,
    )
    expect(screen.getByTestId("report-stress")).toHaveTextContent(
      "Stress test failed: Failed to run Monte Carlo simulation",
    )
  })

  it("should give appendix rows unique keys when retirement rows carry no age", () => {
    const projection = makeReportProjection()
    projection.yearlyProjections = projection.yearlyProjections.map((r) => ({
      ...r,
      age: undefined,
    }))
    const spy = jest.spyOn(console, "error").mockImplementation(() => {})
    render(<IndependenceReport {...baseProps} projection={projection} />)
    const keyWarnings = spy.mock.calls.filter((c) =>
      String(c[0]).includes("same key"),
    )
    spy.mockRestore()
    expect(keyWarnings).toHaveLength(0)
  })
})
