import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import IndependenceMetrics from "../IndependenceMetrics"
import type {
  CompositeProjectionResult,
  IndependencePlan,
  RetirementPlan,
  RetirementProjection,
} from "types/independence"
import {
  makeCompositeProjection,
  makeJourney,
  makePlan as basePlan,
} from "@test-fixtures/independence"
import type { Currency } from "types/beancounter"

// Net sold from investments over the last 12 months, and the user's
// settings; every other request (the modal, the spend log) returns nothing.
const SOLD_LAST_YEAR = 44_000
jest.mock("swr", () => ({
  __esModule: true,
  default: (key: unknown) => {
    if (typeof key === "string" && key.includes("days=365")) {
      return { data: { totalInvested: -SOLD_LAST_YEAR }, isLoading: false }
    }
    if (key === "/api/independence/settings") {
      return {
        data: { lifeExpectancy: 97 },
        isLoading: false,
        mutate: jest.fn(),
      }
    }
    // The seeded simulation: a pot that outlasts the horizon.
    if (Array.isArray(key)) {
      return {
        data: { yearlyBands: [{ year: 2026, age: 66, p10: 1, p50: 1 }] },
        isLoading: false,
      }
    }
    return { data: undefined, error: undefined, isLoading: false }
  },
}))
jest.mock("@hooks/usePrivacyMode", () => ({
  usePrivacyMode: () => ({ hideValues: false }),
}))

const usd = { code: "USD", symbol: "$" } as unknown as Currency

// Typed builder so field names are checked against RetirementPlan (no cast),
// catching schema drift. Defaults encode "Mary": monthly income ≈ expenses,
// but a bonus drives the real net contribution — the old (income - expenses)
// × pct target collapsed to 0.
const makePlan = (overrides: Partial<RetirementPlan> = {}): RetirementPlan =>
  basePlan({
    name: "Retirement",
    planningHorizonYears: 25,
    monthlyExpenses: 3000,
    cashReturnRate: 0.03,
    equityReturnRate: 0.07,
    housingReturnRate: 0.04,
    inflationRate: 0.02,
    cashAllocation: 0.2,
    equityAllocation: 0.6,
    housingAllocation: 0.2,
    workingIncomeMonthly: 2000,
    workingExpensesMonthly: 2000,
    bonusMonthly: 2350,
    investmentAllocationPercent: 0.8,
    isPrimary: true,
    createdDate: "2026-01-01",
    updatedDate: "2026-01-01",
    ...overrides,
  })

const maryPlan = makePlan()

interface JourneyProps {
  journey?: IndependencePlan
  journeyProjection?: CompositeProjectionResult | null
  journeyProjectionLoading?: boolean
}

const render_ = (
  projectionData: RetirementProjection | null,
  totalInvested = 0,
  journeyProps: JourneyProps = {},
): void => {
  render(
    <IndependenceMetrics
      primaryPlan={maryPlan}
      projectionData={projectionData}
      projectionLoading={false}
      {...journeyProps}
      monthlyInvestmentData={{
        startDate: "2026-06-01",
        endDate: "2026-07-01",
        totalInvested,
      }}
      displayCurrency={usd}
      collapsed={false}
      onToggle={jest.fn()}
    />,
  )
}

describe("IndependenceMetrics — retired mode", () => {
  const retired = {
    liquidAssets: 1_000_000,
    currency: "USD",
    yearlyProjections: [{ year: 2026, withdrawals: 40_000 }],
    planInputs: { currentAge: 66, retirementAge: 65 },
  } as unknown as RetirementProjection

  it("shows drawdown cards once the owner has reached retirement age", () => {
    render_(retired)
    expect(screen.getByText("Withdrawal Rate")).toBeInTheDocument()
    expect(screen.getByText("Money Lasts To")).toBeInTheDocument()
  })

  it("hides the saving-phase cards once retired", () => {
    render_(retired)
    expect(screen.queryByText("Monthly Investment")).not.toBeInTheDocument()
    expect(screen.queryByText("Years to FI")).not.toBeInTheDocument()
  })

  it("keeps the saving-phase cards while still working", () => {
    render_({
      ...retired,
      planInputs: { currentAge: 58, retirementAge: 65 },
    } as unknown as RetirementProjection)
    expect(screen.getByText("Monthly Investment")).toBeInTheDocument()
    expect(screen.queryByText("Withdrawal Rate")).not.toBeInTheDocument()
  })
})

describe("IndependenceMetrics — Monthly Investment target", () => {
  it("uses the projection's net-contribution echo as the target", () => {
    render_({
      preRetirementAccumulation: { monthlyContribution: 1880 },
    } as unknown as RetirementProjection)
    // Target denominator reflects the backend-computed contribution, not 0.
    expect(screen.getByText("/ $1,880")).toBeInTheDocument()
  })

  it("falls back to the full net-contribution formula (incl. bonus, net of taxes) when no echo", () => {
    // (2000 + 2350 - 2000 - 0) × 0.8 = 1880 — bonus included, not dropped.
    render_(null)
    expect(screen.getByText("/ $1,880")).toBeInTheDocument()
  })

  it("keeps the actual (this-month invested) as the headline number", () => {
    render_(null, 0)
    // Actual is genuinely 0 (no BUY/SELL this month); target is still 1,880.
    expect(screen.getByText("0% of monthly target")).toBeInTheDocument()
  })
})

describe("IndependenceMetrics — retired tiles report on the journey", () => {
  // One phase, projected alone: a small pot drawn hard — 44k of 400k.
  const phase = {
    planId: "plan-1",
    liquidAssets: 400_000,
    totalAssets: 400_000,
    currency: "USD",
    yearlyProjections: [{ year: 2026, age: 66, withdrawals: 20_000 }],
    planInputs: { currentAge: 66, retirementAge: 65, lifeExpectancy: 90 },
  } as unknown as RetirementProjection

  const journey = makeJourney({
    id: "jrn/1",
    displayCurrency: "USD",
    phases: JSON.stringify([{ planId: "plan-1", fromAge: 65 }]),
  })
  // The journey: the whole pot, and the backend's planned draw on it.
  const journeyProjection = makeCompositeProjection({
    displayCurrency: "USD",
    totalAssets: 2_500_000,
    liquidAssets: 2_000_000,
    currentAge: 66,
    retirementAge: 65,
    plannedAnnualDraw: 50_000,
  })

  const projectionsLink = (): HTMLElement =>
    screen.getByRole("link", { name: "Projections →" })

  it("shows the journey's planned and actual rate, not the phase's", () => {
    render_(phase, 0, { journey, journeyProjection })
    // 50k planned and 44k drawn, of the journey's 2m liquid.
    expect(screen.getByText(/plan 2\.5%/)).toBeInTheDocument()
    expect(screen.getByText("2.2%")).toBeInTheDocument()
    // The phase alone would read 20k planned and 44k drawn, of 400k.
    expect(screen.queryByText(/plan 5\.0%/)).not.toBeInTheDocument()
    expect(screen.queryByText("11.0%")).not.toBeInTheDocument()
  })

  it("sets the draw against the journey's planned draw", () => {
    render_(phase, 0, { journey, journeyProjection })
    expect(screen.getByText("/ $50,000")).toBeInTheDocument()
  })

  it("reads the horizon from the user's settings, not the phase", () => {
    render_(phase, 0, { journey, journeyProjection })
    expect(screen.getByText("97+")).toBeInTheDocument()
    expect(screen.queryByText("90+")).not.toBeInTheDocument()
  })

  it("links to the journey's projections", () => {
    render_(phase, 0, { journey, journeyProjection })
    expect(projectionsLink()).toHaveAttribute(
      "href",
      "/independence?plan=jrn%2F1",
    )
  })

  it("shows the retired tiles when the journey is retired and the phase alone is not", () => {
    render_(
      {
        ...phase,
        planInputs: { currentAge: 58, retirementAge: 65 },
      } as unknown as RetirementProjection,
      0,
      { journey, journeyProjection },
    )
    expect(screen.getByText("Withdrawal Rate")).toBeInTheDocument()
    expect(screen.queryByText("Monthly Investment")).not.toBeInTheDocument()
  })

  it("shows the phase figures, and the phase link, with no journey projection", () => {
    render_(phase)
    expect(screen.getByText(/plan 5\.0%/)).toBeInTheDocument()
    expect(screen.getByText("11.0%")).toBeInTheDocument()
    expect(screen.getByText("/ $20,000")).toBeInTheDocument()
    expect(screen.getByText("90+")).toBeInTheDocument()
    expect(projectionsLink()).toHaveAttribute(
      "href",
      `/independence/plans/${maryPlan.id}`,
    )
  })

  it("falls back to the phase when the journey projection failed", () => {
    render_(phase, 0, { journey, journeyProjection: null })
    expect(screen.getByText(/plan 5\.0%/)).toBeInTheDocument()
    expect(projectionsLink()).toHaveAttribute(
      "href",
      `/independence/plans/${maryPlan.id}`,
    )
  })

  it("leaves a journey still in its working years to the phase tiles", () => {
    render_(
      {
        ...phase,
        planInputs: { currentAge: 58, retirementAge: 65 },
      } as unknown as RetirementProjection,
      0,
      {
        journey,
        journeyProjection: { ...journeyProjection, currentAge: 58 },
      },
    )
    expect(screen.getByText("Monthly Investment")).toBeInTheDocument()
    expect(screen.queryByText("Withdrawal Rate")).not.toBeInTheDocument()
    expect(projectionsLink()).toHaveAttribute(
      "href",
      `/independence/plans/${maryPlan.id}`,
    )
  })

  it("holds the loading state, not the phase's retired tiles, while the journey loads", () => {
    render_(phase, 0, {
      journey,
      journeyProjection: null,
      journeyProjectionLoading: true,
    })
    expect(screen.getByText("Calculating...")).toBeInTheDocument()
    expect(screen.queryByText("Withdrawal Rate")).not.toBeInTheDocument()
    expect(screen.queryByText(/plan 5\.0%/)).not.toBeInTheDocument()
  })
})
