import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import IndependenceMetrics from "../IndependenceMetrics"
import type { RetirementPlan, RetirementProjection } from "types/independence"
import type { Currency } from "types/beancounter"

// Modal SWR is gated on a null key here; return nothing.
jest.mock("swr", () => ({
  __esModule: true,
  default: () => ({ data: undefined, error: undefined, isLoading: false }),
}))
jest.mock("@hooks/usePrivacyMode", () => ({
  usePrivacyMode: () => ({ hideValues: false }),
}))

const usd = { code: "USD", symbol: "$" } as unknown as Currency

// Typed builder so field names are checked against RetirementPlan (no cast),
// catching schema drift. Defaults encode "Mary": monthly income ≈ expenses,
// but a bonus drives the real net contribution — the old (income - expenses)
// × pct target collapsed to 0.
const makePlan = (overrides: Partial<RetirementPlan> = {}): RetirementPlan => ({
  id: "plan-1",
  ownerId: "owner-1",
  name: "Retirement",
  planningHorizonYears: 25,
  lifeExpectancy: 90,
  monthlyExpenses: 3000,
  expensesCurrency: "SGD",
  cashReturnRate: 0.03,
  equityReturnRate: 0.07,
  housingReturnRate: 0.04,
  inflationRate: 0.02,
  cashAllocation: 0.2,
  equityAllocation: 0.6,
  housingAllocation: 0.2,
  pensionMonthly: 0,
  socialSecurityMonthly: 0,
  otherIncomeMonthly: 0,
  workingIncomeMonthly: 2000,
  workingExpensesMonthly: 2000,
  taxesMonthly: 0,
  bonusMonthly: 2350,
  investmentAllocationPercent: 0.8,
  isPrimary: true,
  createdDate: "2026-01-01",
  updatedDate: "2026-01-01",
  ...overrides,
})

const maryPlan = makePlan()

const render_ = (
  projectionData: RetirementProjection | null,
  totalInvested = 0,
): void => {
  render(
    <IndependenceMetrics
      primaryPlan={maryPlan}
      projectionData={projectionData}
      projectionLoading={false}
      monthlyInvestmentData={{ yearMonth: "2026-06", totalInvested }}
      displayCurrency={usd}
      collapsed={false}
      onToggle={jest.fn()}
    />,
  )
}

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
