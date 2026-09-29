import type {
  Finding,
  MonteCarloResult,
  ProjectionWarning,
  RetirementPlan,
  RetirementProjection,
} from "types/independence"
import {
  FIRE_LENS_CODES,
  REPORT_TEMPLATE_VERSION,
  findingPhrase,
  phrases,
} from "./reportPhrases"

/**
 * Pure builder for the Independence analysis report.
 *
 * Takes the DTOs the plan page already holds and returns a ReportModel: every
 * string the report prints, already formatted, in section order. No fetch,
 * no clock, no randomness — same inputs, same model, byte for byte. Charts
 * are rendered by the existing components straight from the projection; this
 * model carries the narrative and the numbers around them.
 *
 * Spec: bc-claude/INDEPENDENCE_REPORT.md.
 */

/** svc-retire serialises absent optionals as JSON `null`; treat both as unset. */
function has<T>(v: T | null | undefined): v is T {
  return v !== null && v !== undefined
}

export interface ReportAges {
  /** Absent until the owner sets a date of birth; the cover prints a dash. */
  currentAge?: number
  retirementAge: number
  lifeExpectancy: number
}

export interface BuildReportInput {
  plan: RetirementPlan
  projection: RetirementProjection
  mc: MonteCarloResult | null
  ages: ReportAges
  /** Display symbol, e.g. "S$". */
  currencySymbol: string
  /** Seed sent with the Monte Carlo request; printed so a reader can re-run it. */
  seed?: number
}

export interface ReportKpi {
  label: string
  value: string
  caption: string
}

export interface ReportFinding extends Finding {
  /** "FIRE lens" when the finding only matters under a FIRE strategy. */
  tag?: string
  /** Report-side gloss from the phrase catalogue, if the code has one. */
  gloss?: string
}

export interface ReportRow {
  label: string
  value: string
}

export interface ReportModel {
  cover: {
    title: string
    planName: string
    asOfDate: string
    currency: string
    valueBasis: string
    strategy: string
    ageLine: string
  }
  verdict: {
    headline: string
    detail: string
    kpis: ReportKpi[]
    sentence: string
  }
  standing: { sentence: string | null }
  journey: { milestones: string[] }
  stress: {
    seed: number | null
    sentence: string
    depletionLine: string | null
    parameters: ReportRow[]
  } | null
  insights: {
    findings: ReportFinding[]
    warnings: string[]
    empty: string | null
  }
  assumptions: ReportRow[]
  footer: { line: string; disclaimer: string; templateVersion: string }
}

const WARNING_TEXT: Record<ProjectionWarning, string> = {
  RENTAL_INCOME_UNAVAILABLE:
    "Rental income could not be fetched; the projection excludes it.",
  NO_EXPENSES: "No expenses are recorded; the plan's monthly figure was used.",
  VALUATION_UNAVAILABLE:
    "A portfolio valuation was unavailable; the last known value was used.",
  WORK_SCENARIO_MISSING:
    "No active work scenario; working income was taken from the plan.",
}

const VALUE_BASIS_TEXT: Record<string, string> = {
  NOMINAL_FUTURE: "future money",
  TODAY: "today's money",
  REAL_TODAY: "today's money",
}

/** Locale pinned: a report must format the same on every machine. */
export function money(value: number, symbol: string): string {
  const rounded = Math.round(value)
  const sign = rounded < 0 ? "-" : ""
  return `${sign}${symbol}${Math.abs(rounded).toLocaleString("en-US")}`
}

/** Short form for KPI tiles only: S$2.1m / S$980k. */
export function moneyShort(value: number, symbol: string): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? "-" : ""
  if (abs >= 1_000_000)
    return `${sign}${symbol}${(abs / 1_000_000).toFixed(1)}m`
  if (abs >= 10_000) return `${sign}${symbol}${Math.round(abs / 1_000)}k`
  return money(value, symbol)
}

export function percent(value: number, decimals = 0): string {
  return `${value.toFixed(decimals)}%`
}

function signedPercent(value: number): string {
  const p = percent(Math.abs(value))
  if (value > 0) return `+${p}`
  if (value < 0) return `-${p}`
  return p
}

interface WealthPoint {
  age: number
  totalWealth: number
}

function peakWealth(projection: RetirementProjection): WealthPoint | null {
  const points: WealthPoint[] = []
  for (const row of projection.accumulationProjections ?? []) {
    points.push({ age: row.age, totalWealth: row.totalWealth })
  }
  for (const row of projection.yearlyProjections ?? []) {
    if (has(row.age)) {
      points.push({ age: row.age, totalWealth: row.totalWealth ?? 0 })
    }
  }
  let peak: WealthPoint | null = null
  for (const p of points) {
    if (peak === null || p.totalWealth > peak.totalWealth) peak = p
  }
  return peak
}

function buildVerdict(
  input: BuildReportInput,
  sym: string,
): ReportModel["verdict"] {
  const { projection, mc, ages } = input
  const first = projection.findings?.[0]
  const lifeExpectancy = String(ages.lifeExpectancy)
  const liquidAtRetirement =
    projection.preRetirementAccumulation?.liquidAssetsAtRetirement ??
    projection.liquidAssets
  const sustainable = projection.sustainableMonthlyExpense
  const adjustment = projection.expenseAdjustmentPercent

  const kpis: ReportKpi[] = [
    {
      label: "Liquid wealth at independence",
      value: moneyShort(liquidAtRetirement, sym),
      caption: phrases.KPI_AT_AGE({ age: String(ages.retirementAge) }),
    },
    {
      label: "Sustainable monthly spend",
      value: has(sustainable) ? money(sustainable, sym) : "—",
      caption: has(adjustment)
        ? phrases.KPI_VS_PLANNED({
            delta: signedPercent(adjustment),
            planned: money(projection.monthlyExpenses, sym),
          })
        : "",
    },
    {
      label: "Money lasts until",
      value: has(projection.depletionAge)
        ? String(projection.depletionAge)
        : `${ages.lifeExpectancy}+`,
      caption: has(projection.depletionAge)
        ? phrases.KPI_RUNWAY({
            years: String(Math.round(projection.runwayYears)),
          })
        : phrases.KPI_BEYOND_HORIZON({ lifeExpectancy }),
    },
    {
      label: "Stress-test success",
      value: mc ? percent(mc.successRate) : "—",
      caption: mc
        ? phrases.KPI_MC_RUNS({
            iterations: mc.iterations.toLocaleString("en-US"),
            seed: has(input.seed) ? String(input.seed) : "—",
          })
        : phrases.KPI_NOT_RUN(),
    },
  ]

  let sentence: string
  if (has(projection.depletionAge)) {
    sentence = phrases.VERDICT_SHORTFALL({
      depletionAge: String(projection.depletionAge),
      shortfallYears: String(
        Math.max(0, ages.lifeExpectancy - projection.depletionAge),
      ),
      lifeExpectancy,
      sustainableMonthlyExpense: has(sustainable)
        ? money(sustainable, sym)
        : "—",
      adjustmentPercent: has(adjustment) ? percent(Math.abs(adjustment)) : "—",
    })
  } else if (mc) {
    sentence = phrases.VERDICT_FUNDED({
      lifeExpectancy,
      terminalP50: money(mc.terminalBalancePercentiles.p50, sym),
    })
  } else {
    sentence = phrases.VERDICT_FUNDED_NO_MC({ lifeExpectancy })
  }

  return {
    headline: first?.title ?? "",
    detail: first?.detail ?? "",
    kpis,
    sentence,
  }
}

function buildStanding(
  projection: RetirementProjection,
  ages: ReportAges,
  sym: string,
): string | null {
  const fi = projection.fiMetrics
  if (!fi) return null
  const fiProgress = percent(fi.fiProgress)
  const fiNumber = money(fi.fiNumber, sym)
  const coast = projection.findings?.some((f) => f.code === "COAST_FI_REACHED")
  if (coast) {
    return phrases.STANDING_COAST({
      fiProgress,
      fiNumber,
      retirementAge: String(ages.retirementAge),
    })
  }
  if (has(projection.fiAchievementAge)) {
    return phrases.STANDING_PROGRESS({
      fiProgress,
      fiNumber,
      fiAchievementAge: String(projection.fiAchievementAge),
    })
  }
  return phrases.STANDING_PROGRESS_NO_AGE({ fiProgress, fiNumber })
}

function buildMilestones(
  projection: RetirementProjection,
  sym: string,
): string[] {
  const out: string[] = []
  if (has(projection.fiAchievementAge)) {
    out.push(
      phrases.MILESTONE_FI_AGE({ age: String(projection.fiAchievementAge) }),
    )
  }
  const sold = projection.yearlyProjections?.some((r) => r.propertyLiquidated)
  if (sold && has(projection.liquidationAge)) {
    out.push(
      phrases.MILESTONE_PROPERTY_SOLD({
        age: String(projection.liquidationAge),
        amount: money(projection.liquidBalanceAtLiquidation ?? 0, sym),
      }),
    )
  }
  if (has(projection.cpfLifeAge)) {
    out.push(phrases.MILESTONE_CPF_LIFE({ age: String(projection.cpfLifeAge) }))
  }
  const peak = peakWealth(projection)
  if (peak) {
    out.push(
      phrases.MILESTONE_PEAK_WEALTH({
        amount: money(peak.totalWealth, sym),
        age: String(peak.age),
      }),
    )
  }
  return out
}

function buildStress(
  mc: MonteCarloResult | null,
  seed: number | null,
  ages: ReportAges,
  sym: string,
): ReportModel["stress"] {
  if (!mc) return null
  const lifeExpectancy = String(ages.lifeExpectancy)
  const p = mc.parameters
  return {
    seed,
    sentence: phrases.STRESS_SUMMARY({
      successRate: percent(mc.successRate),
      iterations: mc.iterations.toLocaleString("en-US"),
      lifeExpectancy,
      terminalP10: money(mc.terminalBalancePercentiles.p10, sym),
      terminalP50: money(mc.terminalBalancePercentiles.p50, sym),
    }),
    depletionLine:
      mc.depletionAgeDistribution.depletedCount === 0
        ? phrases.STRESS_NO_DEPLETION({ lifeExpectancy })
        : null,
    parameters: [
      {
        label: "Expected return",
        value: percent(p.blendedReturnRate * 100, 1),
      },
      { label: "Volatility", value: percent(p.blendedVolatility * 100, 1) },
      { label: "Inflation", value: percent(p.inflationRate * 100, 1) },
      { label: "Iterations", value: mc.iterations.toLocaleString("en-US") },
      { label: "Seed", value: seed === null ? "—" : String(seed) },
    ],
  }
}

function buildInsights(
  projection: RetirementProjection,
): ReportModel["insights"] {
  const notFire = projection.effectiveStrategy !== "FIRE"
  const findings: ReportFinding[] = (projection.findings ?? []).map((f) => {
    const out: ReportFinding = { ...f }
    if (notFire && FIRE_LENS_CODES.has(f.code)) out.tag = "FIRE lens"
    const gloss = findingPhrase(f.code)
    if (gloss) out.gloss = gloss
    return out
  })
  const warnings = (projection.warnings ?? []).map(
    (w) => WARNING_TEXT[w] ?? String(w),
  )
  return {
    findings,
    warnings,
    empty: findings.length === 0 ? phrases.INSIGHTS_EMPTY() : null,
  }
}

function buildAssumptions(
  projection: RetirementProjection,
  ages: ReportAges,
  sym: string,
): ReportRow[] {
  const inputs = projection.planInputs
  const rows: ReportRow[] = []
  if (inputs) {
    rows.push(
      {
        label: "Expected return",
        value: percent(inputs.blendedReturnRate * 100, 1),
      },
      { label: "Inflation", value: percent(inputs.inflationRate * 100, 1) },
    )
  }
  rows.push({
    label: "Housing return",
    value: percent(projection.housingReturnRate * 100, 1),
  })
  if (has(projection.liquidationThresholdPercent)) {
    rows.push({
      label: "Liquidation threshold",
      value: `${projection.liquidationThresholdPercent}% of liquid at ${ages.retirementAge}`,
    })
  }
  rows.push(
    { label: "Independence age", value: String(ages.retirementAge) },
    { label: "Planning horizon", value: `age ${ages.lifeExpectancy}` },
  )
  if (inputs) {
    rows.push({
      label: "Monthly contribution",
      value: money(inputs.monthlyContribution, sym),
    })
  }
  rows.push({
    label: "Planned monthly expenses",
    value: money(projection.monthlyExpenses, sym),
  })
  if (
    projection.planCurrency &&
    projection.planCurrency !== projection.currency &&
    has(projection.displayFxRate)
  ) {
    rows.push({
      label: `FX ${projection.planCurrency} → ${projection.currency}`,
      value: projection.displayFxRate.toFixed(4),
    })
  }
  rows.push({ label: "Scenario", value: phrases.SCENARIO_NONE() })
  return rows
}

export function buildReport(input: BuildReportInput): ReportModel {
  const { plan, projection, mc, ages, currencySymbol: sym } = input
  const seed = mc && has(input.seed) ? input.seed : null
  return {
    cover: {
      title: "Independence analysis",
      planName: plan.name,
      asOfDate: projection.asOfDate,
      currency: projection.currency,
      valueBasis:
        VALUE_BASIS_TEXT[projection.valueBasis?.balanceBasis ?? ""] ??
        "today's money",
      strategy:
        projection.effectiveStrategy ?? projection.primaryStrategy ?? "",
      ageLine: phrases.AGE_LINE({
        currentAge: !has(ages.currentAge) ? "—" : String(ages.currentAge),
        lifeExpectancy: String(ages.lifeExpectancy),
        retirementAge: String(ages.retirementAge),
      }),
    },
    verdict: buildVerdict(input, sym),
    standing: { sentence: buildStanding(projection, ages, sym) },
    journey: { milestones: buildMilestones(projection, sym) },
    stress: buildStress(mc, seed, ages, sym),
    insights: buildInsights(projection),
    assumptions: buildAssumptions(projection, ages, sym),
    footer: {
      line: phrases.FOOTER({
        planName: plan.name,
        asOfDate: projection.asOfDate,
        templateVersion: REPORT_TEMPLATE_VERSION,
      }),
      disclaimer: phrases.DISCLAIMER(),
      templateVersion: REPORT_TEMPLATE_VERSION,
    },
  }
}
