import type { IncomeBreakdown } from "./projection"

// ============ Composite Projection Types ============
export interface CompositePhase {
  planId: string
  fromAge: number
  toAge?: number
}

export interface CompositeProjectionRequest {
  displayCurrency: string
  phases: CompositePhase[]
  /** Optional work scenario ID — overrides persisted/current scenario */
  workScenarioId?: string
}

export interface CompositeYearlyProjection {
  year: number
  age: number
  planId: string
  planName: string
  startingBalance: number
  investmentReturns: number
  income: number
  expenses: number
  endingBalance: number
  nonSpendableValue: number
  /** Real-estate / housing portion of nonSpendableValue. */
  housingValue?: number
  /** CPF MA portion of nonSpendableValue. Locked. */
  cpfNonLiquidValue?: number
  /** CPF LIFE annuity principal portion of nonSpendableValue. Locked. */
  annuitizedValue?: number
  totalWealth: number
  currency: string
  incomeBreakdown?: IncomeBreakdown
}

/**
 * Where the rates a phase actually ran on came from.
 *
 * `MIXED` means the journey states some of them and the stage supplies the
 * rest — the case a client-side comparison of the two rate sets gets wrong,
 * which is why provenance is read from this echo and never re-derived.
 */
export type AssumptionSource = "JOURNEY" | "STAGE" | "MIXED"

/**
 * The effective assumptions one phase was projected with, echoed back by
 * svc-retire. Rates are decimal **fractions** (0.07 = 7%) and are non-null on
 * the wire — the engine ran on a concrete number for each.
 */
export interface PhaseAssumptions {
  source: AssumptionSource
  cashReturnRate: number
  equityReturnRate: number
  housingReturnRate: number
  inflationRate: number
  feeRate: number
  investmentTaxRate: number
}

export interface CompositePhaseInfo {
  planId: string
  planName: string
  fromAge: number
  toAge: number
  expensesCurrency: string
  /**
   * Always sent by svc-retire (#284); optional only to spare fixtures written
   * before the echo existed.
   */
  assumptions?: PhaseAssumptions
}

export interface CompositeProjectionResult {
  /**
   * Assets this journey still earns rent from, keyed by assetId, monthly and
   * net of tax in {@link displayCurrency} — svc-retire converts each phase's
   * figure before unioning them, so label it with the projection's display
   * currency, never the asset config's own `rentalCurrency`. Already scoped
   * to the journey's liquidations and exclusions — read it rather than
   * filtering account-wide asset configs, which know nothing of journeys.
   * Absent on responses predating the echo.
   */
  rentalIncomeByAsset?: Record<string, number>
  asOfDate: string
  displayCurrency: string
  phases: CompositePhaseInfo[]
  totalAssets: number
  liquidAssets: number
  runwayYears: number
  depletionAge?: number
  isSustainable: boolean
  yearlyProjections: CompositeYearlyProjection[]
  warnings: string[]
  /** Pre-retirement accumulation rows (currentAge → firstPhaseAge-1). Empty when already retired. */
  accumulationProjections?: CompositeYearlyProjection[]
  /** Phase-weighted FI number (25× duration-weighted annual net spend), display currency. Portfolio-only (SS excluded). */
  fiNumber?: number
  /** Progress toward fiNumber as %; unclamped (can exceed 100). */
  fiProgress?: number
  /**
   * Combined FI including guaranteed income: (liquid + pvGuaranteedIncomeToday) / fiNumber × 100,
   * unclamped. Lets the FI bar stack portfolio + Social Security. Null when no phase carries SS.
   */
  retirementAgeFiProgress?: number
  /** Present value today of the Social Security stream (first non-zero-SS phase). Null when no SS. */
  pvGuaranteedIncomeToday?: number
  /**
   * Current age used to build this projection, resolved server-side from
   * the plan owner's settings (year + month of birth aware). Authoritative
   * echo — bc-view must prefer this over any client-derived age once a
   * projection has landed (bc-view #1144).
   */
  currentAge?: number
  /**
   * Journey-level target ending balance (svc-retire#282), resolved
   * (`journey.targetBalance ?? stage.targetBalance`) and already converted
   * to {@link displayCurrency} by the backend. Absent when neither the
   * journey nor any phase states one — render nothing in that case, don't
   * default to 0.
   */
  targetBalance?: number
  /**
   * Last phase's ending liquid balance minus {@link targetBalance}, already
   * converted to {@link displayCurrency}. Negative means a deficit. Only
   * meaningful — and only ever sent — alongside {@link targetBalance}.
   */
  surplusOrDeficit?: number
}

export interface CompositeScenarioResult {
  name: string
  description: string
  projection: CompositeProjectionResult
}

export interface CompositeScenarioComparison {
  scenarios: CompositeScenarioResult[]
}
