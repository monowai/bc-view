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

  it("falls back to the phase figures when the journey projection failed", () => {
    render_(phase, 0, { journey, journeyProjection: null })
    expect(screen.getByText(/plan 5\.0%/)).toBeInTheDocument()
    // The journey still exists, so the link still opens it.
    expect(projectionsLink()).toHaveAttribute(
      "href",
      "/independence?plan=jrn%2F1",
    )
  })

  it("shows the working-years tiles for a journey still in its working years", () => {
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

describe("IndependenceMetrics — working-years tiles report on the journey", () => {
  // One phase, projected alone: its own progress, target and property sale.
  const phase = {
    planId: "plan-1",
    currency: "USD",
    liquidAssets: 100_000,
    totalAssets: 100_000,
    fiAchievementAge: 70,
    nonSpendableAtRetirement: 0,
    effectiveHeadlineMetric: "EARLY_RETIREMENT_PROGRESS",
    preRetirementAccumulation: { monthlyContribution: 1_111 },
    fiMetrics: {
      fiProgress: 12.3,
      realYearsToFi: 20,
      isFinanciallyIndependent: false,
    },
    yearlyProjections: [{ year: 2050, age: 74, propertyLiquidated: true }],
    planInputs: { currentAge: 50, retirementAge: 65 },
  } as unknown as RetirementProjection

  const journey = makeJourney({
    id: "jrn/1",
    displayCurrency: "USD",
    phases: JSON.stringify([{ planId: "plan-1", fromAge: 65 }]),
  })
  const journeyProjection = makeCompositeProjection({
    displayCurrency: "USD",
    liquidAssets: 400_000,
    currentAge: 50,
    retirementAge: 65,
    fiNumber: 1_000_000,
    fiProgress: 40,
    retirementAgeFiProgress: 55,
    monthlyContribution: 2_400,
    nonSpendableAtRetirement: 800_000,
    liquidationAge: 82,
    effectiveHeadlineMetric: "EARLY_RETIREMENT_PROGRESS",
    yearlyProjections: [
      { age: 65, endingBalance: 900_000 },
      { age: 66, endingBalance: 1_050_000 },
    ] as CompositeProjectionResult["yearlyProjections"],
  })

  const working = (
    overrides: Partial<CompositeProjectionResult> = {},
    invested = 0,
  ): void =>
    render_(phase, invested, {
      journey,
      journeyProjection: { ...journeyProjection, ...overrides },
    })

  it("shows the journey's progress, not the phase's", () => {
    working()
    expect(screen.getByText("40.0%")).toBeInTheDocument()
    expect(screen.queryByText("12.3%")).not.toBeInTheDocument()
  })

  it("shows retirement-age progress when that is the journey's headline", () => {
    working({ effectiveHeadlineMetric: "RETIREMENT_AGE_FI" })
    expect(screen.getByText("Retirement-Age Progress")).toBeInTheDocument()
    expect(screen.getByText("55.0%")).toBeInTheDocument()
  })

  it("falls back to journey progress for a bridge headline", () => {
    working({ effectiveHeadlineMetric: "BRIDGE_PROGRESS" })
    expect(screen.getByText("Progress")).toBeInTheDocument()
    expect(screen.getByText("40.0%")).toBeInTheDocument()
  })

  it("takes the years to independence from the journey", () => {
    working()
    expect(screen.getByText("16")).toBeInTheDocument()
    expect(screen.getByText("FI at age 66")).toBeInTheDocument()
    expect(screen.queryByText("FI at age 70")).not.toBeInTheDocument()
  })

  it("reports independence once the journey's liquid assets reach its number", () => {
    working({ liquidAssets: 1_000_000 })
    expect(screen.getByText("FI Achieved!")).toBeInTheDocument()
    expect(screen.getByText("Financially Independent!")).toBeInTheDocument()
  })

  it("sets investing against the journey's contribution", () => {
    working()
    expect(screen.getByText("/ $2,400")).toBeInTheDocument()
    expect(screen.queryByText("/ $1,111")).not.toBeInTheDocument()
  })

  it("does not compute a target when the journey states no contribution", () => {
    working({ monthlyContribution: undefined })
    expect(screen.getByText("Monthly target unavailable")).toBeInTheDocument()
    // Neither the phase's echo nor the plan formula stands in for it.
    expect(screen.queryByText("/ $1,111")).not.toBeInTheDocument()
    expect(screen.queryByText("/ $1,880")).not.toBeInTheDocument()
  })

  it("labels a target in another currency and does not compare against it", () => {
    working({ displayCurrency: "NZD" }, 1_200)
    expect(screen.getByText("/ NZD 2,400")).toBeInTheDocument()
    expect(screen.getByText("Target is in NZD")).toBeInTheDocument()
    expect(screen.queryByText("50% of monthly target")).not.toBeInTheDocument()
  })

  it("reads the property sale from the journey", () => {
    working()
    expect(screen.getByText("82")).toBeInTheDocument()
    expect(screen.queryByText("74")).not.toBeInTheDocument()
  })

  it("says the sale is not needed when the journey holds property it never sells", () => {
    working({ liquidationAge: undefined })
    expect(screen.getByText("Not needed")).toBeInTheDocument()
  })

  it("does not claim there are no illiquid assets when the journey does not say", () => {
    working({ liquidationAge: undefined, nonSpendableAtRetirement: undefined })
    expect(screen.queryByText("No illiquid assets")).not.toBeInTheDocument()
    expect(screen.queryByText("Not needed")).not.toBeInTheDocument()
  })

  it("links to the journey's projections", () => {
    working()
    expect(screen.getByRole("link", { name: "Projections →" })).toHaveAttribute(
      "href",
      "/independence?plan=jrn%2F1",
    )
  })

  it("holds the loading state, not the phase's figures, while the journey loads", () => {
    render_(phase, 0, {
      journey,
      journeyProjection: null,
      journeyProjectionLoading: true,
    })
    expect(screen.getByText("Calculating...")).toBeInTheDocument()
    expect(screen.queryByText("12.3%")).not.toBeInTheDocument()
    expect(screen.queryByText("/ $1,111")).not.toBeInTheDocument()
    expect(screen.queryByText("/ $1,880")).not.toBeInTheDocument()
  })

  it("keeps the phase figures when there is no journey", () => {
    render_(phase)
    expect(screen.getByText("12.3%")).toBeInTheDocument()
    expect(screen.getByText("/ $1,111")).toBeInTheDocument()
    expect(screen.getByText("20")).toBeInTheDocument()
    expect(screen.getByText("FI at age 70")).toBeInTheDocument()
    expect(screen.getByText("74")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Projections →" })).toHaveAttribute(
      "href",
      `/independence/plans/${maryPlan.id}`,
    )
  })
})
