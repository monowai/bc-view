import type {
  YearlyAccumulation,
  YearlyProjection,
  CompositeYearlyProjection,
} from "types/independence"

export type JourneyStatus =
  | "building"
  | "covered"
  | "onTrack"
  | "thinning"
  | "shortfall"

export interface JourneyCell {
  age: number
  status: JourneyStatus
  note: string
  isAccumulation: boolean
}

export interface JourneyRibbonData {
  cells: JourneyCell[]
  verdict: string
  verdictTone: "good" | "warn" | "bad"
  depletionAge?: number
}

export interface NormalizedJourneyRow {
  age: number
  isAccumulation: boolean
  endingBalance: number
  unfundedExpense: number
  expenses: number
  cashflowIncome: number
}

function isShortfallRow(row: NormalizedJourneyRow): boolean {
  if (row.isAccumulation) return false
  return row.unfundedExpense > 0 || row.endingBalance <= 0
}

export function deriveJourneyRibbon(
  rows: NormalizedJourneyRow[],
): JourneyRibbonData {
  if (rows.length === 0) {
    return { cells: [], verdict: "", verdictTone: "good" }
  }

  const lastAge = rows[rows.length - 1].age

  // Pre-compute depletionAge (first shortfall year)
  const depletionAge = rows.find((r) => isShortfallRow(r))?.age

  const cells: JourneyCell[] = rows.map((row, idx) => {
    if (row.isAccumulation) {
      return {
        age: row.age,
        status: "building",
        note: `Age ${row.age} — building wealth: saving and growing`,
        isAccumulation: true,
      }
    }

    if (isShortfallRow(row)) {
      const isFirstShortfall = row.age === depletionAge
      return {
        age: row.age,
        status: "shortfall",
        note: isFirstShortfall
          ? `Age ${row.age} — savings run out this year`
          : `Age ${row.age} — expenses unfunded`,
        isAccumulation: false,
      }
    }

    if (row.cashflowIncome >= row.expenses && row.expenses > 0) {
      return {
        age: row.age,
        status: "covered",
        note: `Age ${row.age} — income covers expenses`,
        isAccumulation: false,
      }
    }

    // Withdrawing from savings — check if any later row is shortfall
    const hasLaterShortfall = rows.slice(idx + 1).some((r) => isShortfallRow(r))

    if (hasLaterShortfall) {
      return {
        age: row.age,
        status: "thinning",
        note: `Age ${row.age} — spending from savings; money runs out at ${depletionAge}`,
        isAccumulation: false,
      }
    }

    return {
      age: row.age,
      status: "onTrack",
      note: `Age ${row.age} — spending from savings, on track: money lasts to ${lastAge}+`,
      isAccumulation: false,
    }
  })

  // Verdict
  if (!depletionAge) {
    return {
      cells,
      verdict: `Money lasts to age ${lastAge}+`,
      verdictTone: "good",
    }
  }

  const yearsShort = lastAge - depletionAge
  const verdictText = `Savings run out at ${depletionAge} — ${yearsShort} year${yearsShort !== 1 ? "s" : ""} short`
  const lastRow = rows[rows.length - 1]
  // Warn when shortfall exists but final year has positive balance (lumpy expense, recovery after)
  const verdictTone = lastRow.endingBalance > 0 ? "warn" : "bad"

  return {
    cells,
    verdict: verdictText,
    verdictTone,
    depletionAge,
  }
}

/** Map single-plan arrays to normalized rows. */
export function fromSinglePlan(
  accumRows: YearlyAccumulation[],
  drawdownRows: YearlyProjection[],
): NormalizedJourneyRow[] {
  const normalized: NormalizedJourneyRow[] = [
    ...accumRows.map(
      (y): NormalizedJourneyRow => ({
        age: y.age,
        isAccumulation: true,
        endingBalance: y.endingBalance,
        unfundedExpense: 0,
        expenses: 0,
        cashflowIncome: 0,
      }),
    ),
    ...drawdownRows.map((y): NormalizedJourneyRow => {
      const ib = y.incomeBreakdown
      const cashflowIncome = ib ? ib.totalIncome - ib.investmentReturns : 0
      return {
        age: y.age ?? 0,
        isAccumulation: false,
        endingBalance: y.endingBalance,
        unfundedExpense: y.unfundedExpense ?? 0,
        expenses: y.inflationAdjustedExpenses,
        cashflowIncome,
      }
    }),
  ]
  return normalized
}

/** Map composite projection rows (accumulation + drawdown interleaved or separate) to normalized rows. */
export function fromCompositeRows(
  rows: CompositeYearlyProjection[],
): NormalizedJourneyRow[] {
  return rows.map((row): NormalizedJourneyRow => {
    // Accumulation rows have expenses=0 (pre-retirement, no drawdown)
    const isAccumulation = row.expenses === 0
    const ib = row.incomeBreakdown
    const cashflowIncome = ib
      ? ib.totalIncome - ib.investmentReturns
      : row.income
    return {
      age: row.age,
      isAccumulation,
      endingBalance: row.endingBalance,
      unfundedExpense: 0,
      expenses: row.expenses,
      cashflowIncome,
    }
  })
}
