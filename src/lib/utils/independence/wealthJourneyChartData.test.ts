import { buildWealthJourneyChartData } from "./wealthJourneyChartData"
import type { CompositeYearlyProjection } from "types/independence"

const makeYear = (
  overrides: Partial<CompositeYearlyProjection> = {},
): CompositeYearlyProjection => ({
  year: 2026,
  age: 45,
  planId: "p1",
  planName: "My Independence Plan",
  startingBalance: 100_000,
  investmentReturns: 3_000,
  income: 0,
  expenses: 0,
  endingBalance: 103_000,
  nonSpendableValue: 0,
  totalWealth: 103_000,
  currency: "SGD",
  ...overrides,
})

describe("buildWealthJourneyChartData", () => {
  it("hides Housing layer when reported housingValue is purely CPF MA bleed", () => {
    // Mary persona: no real estate. svc-retire still folds CPF MA into
    // housingValue upstream (PlanAllocationService:117). After netting MA
    // out, the pure housing share is zero — the Housing legend entry must
    // disappear so the user isn't told they own property they don't have.
    const years: CompositeYearlyProjection[] = [
      makeYear({
        housingValue: 58_000,
        cpfNonLiquidValue: 58_000,
        annuitizedValue: 0,
      }),
      makeYear({
        age: 46,
        housingValue: 60_320,
        cpfNonLiquidValue: 60_320,
        annuitizedValue: 0,
      }),
    ]

    const { hasHousingLayer, chartData } = buildWealthJourneyChartData(years)

    expect(hasHousingLayer).toBe(false)
    expect(chartData.every((d) => d.housingValue === 0)).toBe(true)
  })

  it("keeps Housing layer when real property exists on top of CPF MA", () => {
    const years: CompositeYearlyProjection[] = [
      makeYear({
        housingValue: 558_000,
        cpfNonLiquidValue: 58_000,
        annuitizedValue: 0,
      }),
    ]

    const { hasHousingLayer, chartData } = buildWealthJourneyChartData(years)

    expect(hasHousingLayer).toBe(true)
    expect(chartData[0].housingValue).toBe(500_000)
  })

  it("hides Annuitized layer when never present", () => {
    const years: CompositeYearlyProjection[] = [
      makeYear({ annuitizedValue: 0 }),
      makeYear({ age: 46, annuitizedValue: 0 }),
    ]

    const { hasAnnuitizedLayer } = buildWealthJourneyChartData(years)

    expect(hasAnnuitizedLayer).toBe(false)
  })

  it("keeps Annuitized layer when any year has positive value", () => {
    const years: CompositeYearlyProjection[] = [
      makeYear({ annuitizedValue: 0 }),
      makeYear({ age: 65, annuitizedValue: 220_000 }),
    ]

    const { hasAnnuitizedLayer } = buildWealthJourneyChartData(years)

    expect(hasAnnuitizedLayer).toBe(true)
  })

  it("treats missing optional fields as zero", () => {
    const years: CompositeYearlyProjection[] = [
      makeYear({
        housingValue: undefined,
        cpfNonLiquidValue: undefined,
        annuitizedValue: undefined,
      }),
    ]

    const { hasHousingLayer, hasAnnuitizedLayer, chartData } =
      buildWealthJourneyChartData(years)

    expect(hasHousingLayer).toBe(false)
    expect(hasAnnuitizedLayer).toBe(false)
    expect(chartData[0].housingValue).toBe(0)
    expect(chartData[0].annuitizedValue).toBe(0)
  })
})
