import type { RetirementProjection } from "types/independence"
import { makeCompositeProjection, makePlan } from "@test-fixtures/independence"
import { journeyWorkingBasis, phaseWorkingBasis } from "./workingBasis"

const row = (age: number, endingBalance: number): never =>
  ({ age, endingBalance }) as never

describe("journeyWorkingBasis", () => {
  const journey = makeCompositeProjection({
    displayCurrency: "NZD",
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
    yearlyProjections: [row(65, 900_000), row(66, 1_050_000)],
  })

  it("echoes the journey's contribution in the journey's currency", () => {
    const basis = journeyWorkingBasis(journey)
    expect(basis.monthlyContribution).toBe(2_400)
    expect(basis.currency).toBe("NZD")
  })

  it("leaves the contribution unknown when the journey does not state one", () => {
    const basis = journeyWorkingBasis({
      ...journey,
      monthlyContribution: undefined,
    })
    expect(basis.monthlyContribution).toBeUndefined()
  })

  it("features plain progress from the journey's own figure", () => {
    const { headline } = journeyWorkingBasis(journey).outlook!
    expect(headline.label).toBe("Progress")
    expect(headline.display).toBe("40.0%")
  })

  it("features retirement-age progress when that is the journey's headline", () => {
    const { headline } = journeyWorkingBasis({
      ...journey,
      effectiveHeadlineMetric: "RETIREMENT_AGE_FI",
    }).outlook!
    expect(headline.label).toBe("Retirement-Age Progress")
    expect(headline.display).toBe("55.0%")
  })

  it("falls back to journey progress for a bridge headline, which has no journey figure", () => {
    const { headline } = journeyWorkingBasis({
      ...journey,
      effectiveHeadlineMetric: "BRIDGE_PROGRESS",
    }).outlook!
    expect(headline.label).toBe("Progress")
    expect(headline.display).toBe("40.0%")
  })

  it("takes independence and the years to it from the journey's own rows", () => {
    const { independent, yearsToFi, fiAge } =
      journeyWorkingBasis(journey).outlook!
    expect(independent).toBe(false)
    expect(fiAge).toBe(66)
    expect(yearsToFi).toBe(16)
  })

  it("is independent once liquid assets reach the journey's number", () => {
    const { independent } = journeyWorkingBasis({
      ...journey,
      liquidAssets: 1_000_000,
    }).outlook!
    expect(independent).toBe(true)
  })

  it("reads the property sale from the journey", () => {
    const { liquidationAge, hasProperty } =
      journeyWorkingBasis(journey).outlook!
    expect(liquidationAge).toBe(82)
    expect(hasProperty).toBe(true)
  })

  it("does not claim there is no property when the journey does not say", () => {
    const { hasProperty } = journeyWorkingBasis({
      ...journey,
      nonSpendableAtRetirement: undefined,
    }).outlook!
    expect(hasProperty).toBeUndefined()
  })

  it("reports no property when the journey carries none", () => {
    const { hasProperty } = journeyWorkingBasis({
      ...journey,
      nonSpendableAtRetirement: 0,
    }).outlook!
    expect(hasProperty).toBe(false)
  })
})

describe("phaseWorkingBasis", () => {
  const plan = makePlan({
    workingIncomeMonthly: 2000,
    workingExpensesMonthly: 2000,
    bonusMonthly: 2350,
    investmentAllocationPercent: 0.8,
  })

  it("prefers the projection's contribution echo", () => {
    const basis = phaseWorkingBasis(
      {
        preRetirementAccumulation: { monthlyContribution: 1500 },
      } as unknown as RetirementProjection,
      plan,
    )
    expect(basis.monthlyContribution).toBe(1500)
  })

  it("computes the contribution from the plan until a projection lands", () => {
    const basis = phaseWorkingBasis(null, plan)
    expect(basis.monthlyContribution).toBe(1880)
    expect(basis.outlook).toBeNull()
  })

  it("reads the outlook from the phase projection", () => {
    const { outlook } = phaseWorkingBasis(
      {
        currency: "USD",
        fiAchievementAge: 61,
        nonSpendableAtRetirement: 500_000,
        fiMetrics: {
          fiProgress: 30,
          realYearsToFi: 10.6,
          isFinanciallyIndependent: false,
        },
        yearlyProjections: [
          { age: 79, propertyLiquidated: false },
          { age: 80, propertyLiquidated: true },
        ],
      } as unknown as RetirementProjection,
      plan,
    )
    expect(outlook).toMatchObject({
      independent: false,
      yearsToFi: 11,
      fiAge: 61,
      liquidationAge: 80,
      hasProperty: true,
    })
    expect(outlook?.headline.display).toBe("30.0%")
  })
})
