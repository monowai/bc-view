import type { CompositeYearlyProjection } from "types/independence"

interface RowWithLockedBuckets {
  housingValue?: number
  cpfNonLiquidValue?: number
}

// svc-retire's RetirementPhaseProjector can leave a sub-cent housingValue
// residue (BigDecimal scale artefacts) even for users with no real estate,
// which makes a `housingValue > 0` gate render a phantom Housing legend
// entry. Netting cpfNonLiquidValue out + max(0, ...) collapses that
// residue to zero while leaving real-property scenarios untouched.
export function netHousingValue(row: RowWithLockedBuckets): number {
  const cpfNonLiquid = row.cpfNonLiquidValue ?? 0
  const rawHousing = row.housingValue ?? 0
  return Math.max(0, rawHousing - cpfNonLiquid)
}

export interface WealthJourneyChartRow {
  age: number
  endingBalance: number
  totalWealth: number
  liquidValue: number
  housingValue: number
  annuitizedValue: number
  income: number
  expenses: number
  planId: string
  planName: string
}

export interface WealthJourneyChartData {
  chartData: WealthJourneyChartRow[]
  hasHousingLayer: boolean
  hasAnnuitizedLayer: boolean
}

// svc-retire's PlanAllocationService folds CPF MA (composite non-liquid) into
// `housingValue` upstream. For users with no real estate but a CPF MA balance,
// the raw `housingValue` is non-zero even though the chart's Housing layer is
// supposed to mean Property only. [netHousingValue] recovers the pure property
// share; if it's zero, the Housing legend entry is dropped so the user isn't
// told they own real estate they don't have.
export function buildWealthJourneyChartData(
  yearlyProjections: CompositeYearlyProjection[],
): WealthJourneyChartData {
  const chartData: WealthJourneyChartRow[] = yearlyProjections.map((row) => ({
    age: row.age,
    endingBalance: row.endingBalance,
    totalWealth: row.totalWealth,
    liquidValue: row.endingBalance,
    housingValue: netHousingValue(row),
    annuitizedValue: row.annuitizedValue ?? 0,
    income: row.income,
    expenses: row.expenses,
    planId: row.planId,
    planName: row.planName,
  }))

  const hasHousingLayer = chartData.some((p) => p.housingValue > 0)
  const hasAnnuitizedLayer = chartData.some((p) => p.annuitizedValue > 0)

  return { chartData, hasHousingLayer, hasAnnuitizedLayer }
}
