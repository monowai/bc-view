import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import RetiredMetrics from "../RetiredMetrics"
import { phaseRetiredBasis } from "@lib/independence/retiredBasis"
import type {
  MonteCarloResult,
  RetirementProjection,
  YearlyPercentileBand,
} from "types/independence"

jest.mock("@hooks/usePrivacyMode", () => ({
  usePrivacyMode: () => ({ hideValues: false }),
}))

// Retired at 66 on a $1m liquid pot; plan draws $40k a year from it.
const projection = {
  liquidAssets: 1_000_000,
  currency: "NZD",
  yearlyProjections: [{ year: 2026, withdrawals: 40_000 }],
  planInputs: { currentAge: 66, retirementAge: 65, lifeExpectancy: 95 },
} as unknown as RetirementProjection

const band = (age: number, p10: number, p50: number): YearlyPercentileBand => ({
  year: 2026 + (age - 66),
  age,
  p5: p10,
  p10,
  p25: p50,
  p50,
  p75: p50,
  p90: p50,
  p95: p50,
})

const monteCarlo = {
  successRate: 87.4,
  yearlyBands: [band(66, 900_000, 1_000_000), band(88, 0, 400_000)],
} as unknown as MonteCarloResult

const renderCards = (
  overrides: Partial<React.ComponentProps<typeof RetiredMetrics>> = {},
): void => {
  render(
    <RetiredMetrics
      basis={phaseRetiredBasis(projection)}
      drawnLastMonth={3_500}
      drawnLastYear={44_000}
      monteCarlo={monteCarlo}
      monteCarloLoading={false}
      monteCarloUnavailable={false}
      currencySymbol="$"
      spend={null}
      spendUnavailable={false}
      spendOtherCurrency={null}
      onLogSpend={jest.fn()}
      {...overrides}
    />,
  )
}

describe("RetiredMetrics", () => {
  describe("when the planned draw is unknown", () => {
    const unknownPlan = {
      ...phaseRetiredBasis(projection),
      plannedAnnualDraw: undefined,
    }

    it("gives no withdrawal verdict", () => {
      renderCards({ basis: unknownPlan })
      expect(screen.queryByText("No planned draw this year")).toBeNull()
      expect(screen.queryByText("On track")).toBeNull()
      expect(screen.queryByText(/plan 0\.0%/)).toBeNull()
    })

    it("shows what was drawn without a plan of nothing beside it", () => {
      renderCards({ basis: unknownPlan })
      expect(screen.getByText("$44,000")).toBeInTheDocument()
      expect(screen.queryByText("/ $0")).toBeNull()
      expect(screen.getByText("Planned draw unavailable")).toBeInTheDocument()
    })
  })

  it("shows the actual withdrawal rate against the planned rate", () => {
    renderCards()
    expect(screen.getByText("Withdrawal Rate")).toBeInTheDocument()
    expect(screen.getByText("4.4%")).toBeInTheDocument()
    expect(screen.getByText(/plan 4\.0%/)).toBeInTheDocument()
    expect(screen.getByText("On track")).toBeInTheDocument()
  })

  it("warns when drawing more than 20% over plan", () => {
    renderCards({ drawnLastYear: 55_000 })
    expect(
      screen.getByText("Above plan — consider trimming"),
    ).toBeInTheDocument()
  })

  it("compares the last 12 months' draw with the year's plan", () => {
    renderCards()
    expect(screen.getByText("Drawn vs Plan")).toBeInTheDocument()
    expect(screen.getByText("$44,000")).toBeInTheDocument()
    expect(screen.getByText("/ $40,000")).toBeInTheDocument()
    expect(
      screen.getByText("Last 30 days: $3,500 of $3,333"),
    ).toBeInTheDocument()
  })

  it("does not show a pass-fail success rate", () => {
    renderCards()
    expect(screen.queryByText("Plan Success")).not.toBeInTheDocument()
    expect(screen.queryByText("87%")).not.toBeInTheDocument()
  })

  it("shows the age the money lasts to on the median and bad-case paths", () => {
    renderCards()
    expect(screen.getByText("Money Lasts To")).toBeInTheDocument()
    expect(screen.getByText("95+")).toBeInTheDocument()
    expect(
      screen.getByText("Bad case (bottom 10%): age 88"),
    ).toBeInTheDocument()
  })

  it("says the simulation is running while it has no result", () => {
    renderCards({ monteCarlo: null, monteCarloLoading: true })
    expect(screen.getByText("Simulating…")).toBeInTheDocument()
  })

  it("says the simulation is unavailable when it failed", () => {
    renderCards({ monteCarlo: null, monteCarloUnavailable: true })
    expect(screen.getByText("Simulation unavailable")).toBeInTheDocument()
  })

  describe("with recorded spend", () => {
    // 3 months recorded: 10,500 spent against a 9,000 budget; that
    // overspend lifts the 40k planned draw to 46k a year.
    const spend = {
      monthsEntered: 3,
      monthsEstimated: 0,
      actual: 10_500,
      budget: 9_000,
      annualDraw: 46_000,
    }

    it("compares recorded spend with budget instead of investment sales", () => {
      renderCards({ spend })
      expect(screen.getByText("Spend vs Budget")).toBeInTheDocument()
      expect(screen.queryByText("Drawn vs Plan")).not.toBeInTheDocument()
      expect(screen.getByText("$10,500")).toBeInTheDocument()
      expect(screen.getByText("/ $9,000")).toBeInTheDocument()
      expect(screen.getByText("3 months recorded")).toBeInTheDocument()
    })

    it("says how many recorded months are estimates", () => {
      renderCards({ spend: { ...spend, monthsEstimated: 1 } })
      expect(
        screen.getByText("3 months recorded (1 estimated)"),
      ).toBeInTheDocument()
    })

    it("drives the withdrawal rate from the draw recorded spend implies", () => {
      renderCards({ spend })
      expect(screen.getByText("4.6%")).toBeInTheDocument()
      expect(
        screen.getByText("From recorded spend, share of liquid assets"),
      ).toBeInTheDocument()
    })
  })

  it("says when the spend log could not be loaded", () => {
    renderCards({ spendUnavailable: true })
    expect(
      screen.getByText("Spend log unavailable — showing investment sales"),
    ).toBeInTheDocument()
  })

  it("says why spend logged in another currency is not compared", () => {
    renderCards({ spendOtherCurrency: "SGD" })
    expect(
      screen.getByText("Spend is logged in SGD — showing investment sales"),
    ).toBeInTheDocument()
  })

  it("opens the spend log from the card", () => {
    const onLogSpend = jest.fn()
    renderCards({ onLogSpend })
    fireEvent.click(screen.getByRole("button", { name: "Log spend" }))
    expect(onLogSpend).toHaveBeenCalled()
  })
})
