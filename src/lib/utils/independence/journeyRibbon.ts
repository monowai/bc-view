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

export interface JourneyRibbonOpts {
  /** Backend-authoritative depletion age; overrides client detection for the verdict string. */
  depletionAge?: number | null
  /** Currency code for shortfall notes (e.g. "SGD"). Empty string = omit prefix. */
  currency?: string
}

function isShortfallRow(row: NormalizedJourneyRow): boolean {
  if (row.isAccumulation) return false
  return row.unfundedExpense > 0 || row.endingBalance <= 0
}

export function deriveJourneyRibbon(
  rows: NormalizedJourneyRow[],
  opts?: JourneyRibbonOpts,
): JourneyRibbonData {
  if (rows.length === 0) {
    return { cells: [], verdict: "", verdictTone: "good" }
  }

  const lastAge = rows[rows.length - 1].age

  // Client-side detection: used for cell status/coloring and "savings run out this year" note
  const clientDepletionAge = rows.find((r) => isShortfallRow(r))?.age

  // Verdict depletion age: backend value takes precedence; client detection is the fallback
  const verdictDepletionAge =
    opts?.depletionAge != null ? opts.depletionAge : clientDepletionAge

  const currency = opts?.currency ?? ""

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
      const isFirstShortfall = row.age === clientDepletionAge
      if (isFirstShortfall) {
        return {
          age: row.age,
          status: "shortfall",
          note: `Age ${row.age} — savings run out this year`,
          isAccumulation: false,
        }
      }
      // Later shortfall: if annuity income is partially covering expenses, say so
      if (row.cashflowIncome > 0) {
        const prefix = currency ? `${currency} ` : ""
        const shortfallK = Math.round(row.unfundedExpense / 1_000)
        return {
          age: row.age,
          status: "shortfall",
          note: `Age ${row.age} — savings gone; guaranteed income covers part (${prefix}${shortfallK}k/yr short)`,
          isAccumulation: false,
        }
      }
      return {
        age: row.age,
        status: "shortfall",
        note: `Age ${row.age} — expenses unfunded`,
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

    // Withdrawing from savings — reference the NEXT shortfall, not the first
    // overall (after a recovery year the first shortfall is already in the past)
    const nextShortfallAge = rows
      .slice(idx + 1)
      .find((r) => isShortfallRow(r))?.age

    if (nextShortfallAge != null) {
      return {
        age: row.age,
        status: "thinning",
        note: `Age ${row.age} — spending from savings; money runs out at ${nextShortfallAge}`,
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
  if (!verdictDepletionAge) {
    return {
      cells,
      verdict: `Money lasts to age ${lastAge}+`,
      verdictTone: "good",
    }
  }

  // Rows strictly after the verdict depletion age (post-depletion)
  const postDepletionRows = rows.filter(
    (r) => !r.isAccumulation && r.age > verdictDepletionAge,
  )
  const hasAnnuityIncome = postDepletionRows.some((r) => r.cashflowIncome > 0)

  if (hasAnnuityIncome) {
    // Guaranteed income keeps paying after savings run out, but a shortfall remains.
    // Tone is warn if a post-depletion row fully recovers (non-shortfall), bad otherwise.
    const hasRecovery = postDepletionRows.some((r) => !isShortfallRow(r))
    const verdictTone = hasRecovery ? "warn" : "bad"
    return {
      cells,
      verdict: `Savings run out at ${verdictDepletionAge} — annuity keeps paying but leaves a shortfall`,
      verdictTone,
      depletionAge: verdictDepletionAge,
    }
  }

  // No annuity income post-depletion — classic "N years short" verdict
  const yearsShort = lastAge - verdictDepletionAge
  const verdictText = `Savings run out at ${verdictDepletionAge} — ${yearsShort} year${yearsShort !== 1 ? "s" : ""} short`
  const lastRow = rows[rows.length - 1]
  // Warn when shortfall exists but final year balance is positive (lumpy expense / recovery)
  const verdictTone = lastRow.endingBalance > 0 ? "warn" : "bad"

  return {
    cells,
    verdict: verdictText,
    verdictTone,
    depletionAge: verdictDepletionAge,
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
