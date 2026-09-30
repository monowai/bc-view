import type {
  CompositeProjectionResult,
  CompositeYearlyProjection,
  MonteCarloResult,
} from "types/independence"
import {
  buildStress,
  has,
  money,
  moneyShort,
  percent,
  warningText,
  type ReportKpi,
  type ReportModel,
  type ReportRow,
} from "./buildReport"
import { REPORT_TEMPLATE_VERSION, phrases } from "./reportPhrases"

/**
 * Pure builder for the journey-level Independence report: one
 * CompositeProjectionResult (every stage stitched end to end) plus the
 * composite Monte Carlo run. Same contract as buildReport — no fetch, no
 * clock, no randomness.
 *
 * The composite carries no findings, so per-stage insights are rendered next
 * to this model from each stage plan's own projection, not built here.
 *
 * Spec: bc-claude/INDEPENDENCE_REPORT.md.
 */
export interface BuildJourneyReportInput {
  journeyName: string
  projection: CompositeProjectionResult
  mc: MonteCarloResult | null
  /** Display symbol, e.g. "S$". */
  currencySymbol: string
  /** Seed sent with the Monte Carlo request; printed so a reader can re-run it. */
  seed?: number
}

export interface JourneyStageRow {
  planId: string
  name: string
  /** "60–69" */
  ages: string
  /** Spending in the stage's first year, display currency. */
  firstYearSpend: string
  /** Liquid balance at the end of the stage's last year. */
  endingBalance: string
}

export interface JourneyReportModel {
  cover: {
    title: string
    journeyName: string
    asOfDate: string
    currency: string
    stageLine: string
    ageLine: string
  }
  verdict: { headline: string; kpis: ReportKpi[]; sentence: string }
  standing: { fiProgress: number | null; sentence: string | null }
  stages: JourneyStageRow[]
  stress: ReportModel["stress"]
  warnings: string[]
  assumptions: ReportRow[]
  footer: ReportModel["footer"]
}

export interface JourneyAges {
  currentAge?: number
  /** First stage's starting age. */
  independenceAge: number
  /** Last stage's final age. */
  lifeExpectancy: number
}

export function journeyAges(
  projection: CompositeProjectionResult,
): JourneyAges {
  const phases = projection.phases
  const first = phases[0]
  const last = phases[phases.length - 1]
  const lastRow =
    projection.yearlyProjections[projection.yearlyProjections.length - 1]
  return {
    currentAge: has(projection.currentAge) ? projection.currentAge : undefined,
    independenceAge: first?.fromAge ?? lastRow?.age ?? 0,
    lifeExpectancy: last?.toAge ?? lastRow?.age ?? 0,
  }
}

function stageRows(
  projection: CompositeProjectionResult,
  planId: string,
): CompositeYearlyProjection[] {
  return projection.yearlyProjections.filter((r) => r.planId === planId)
}

function buildVerdict(
  input: BuildJourneyReportInput,
  ages: JourneyAges,
  sym: string,
): JourneyReportModel["verdict"] {
  const { projection, mc } = input
  const lifeExpectancy = String(ages.lifeExpectancy)
  const depletionAge = has(projection.depletionAge)
    ? projection.depletionAge
    : null
  const rows = projection.yearlyProjections
  const firstRow = rows[0]
  const lastRow = rows[rows.length - 1]

  const endingKpi: ReportKpi =
    has(projection.targetBalance) && has(projection.surplusOrDeficit)
      ? {
          label: "Ending balance vs target",
          value: moneyShort(projection.surplusOrDeficit, sym),
          caption: phrases.KPI_TARGET({
            target: money(projection.targetBalance, sym),
          }),
        }
      : {
          label: "Ending liquid balance",
          value: lastRow ? moneyShort(lastRow.endingBalance, sym) : "—",
          caption: phrases.KPI_AT_AGE({ age: lifeExpectancy }),
        }

  const kpis: ReportKpi[] = [
    {
      label: "Liquid wealth at independence",
      value: moneyShort(
        firstRow?.startingBalance ?? projection.liquidAssets,
        sym,
      ),
      caption: phrases.KPI_AT_AGE({ age: String(ages.independenceAge) }),
    },
    {
      label: "Money lasts until",
      value:
        depletionAge === null ? `${lifeExpectancy}+` : String(depletionAge),
      caption:
        depletionAge === null
          ? phrases.KPI_BEYOND_HORIZON({ lifeExpectancy })
          : phrases.KPI_RUNWAY({
              years: String(Math.round(projection.runwayYears)),
            }),
    },
    endingKpi,
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

  if (depletionAge !== null) {
    return {
      headline: phrases.JOURNEY_HEADLINE_SHORT({
        depletionAge: String(depletionAge),
      }),
      kpis,
      sentence: phrases.JOURNEY_SHORTFALL({
        depletionAge: String(depletionAge),
        shortfallYears: String(Math.max(0, ages.lifeExpectancy - depletionAge)),
        lifeExpectancy,
      }),
    }
  }
  return {
    headline: phrases.JOURNEY_HEADLINE_FUNDED({ lifeExpectancy }),
    kpis,
    sentence: mc
      ? phrases.VERDICT_FUNDED({
          lifeExpectancy,
          terminalP50: money(mc.terminalBalancePercentiles.p50, sym),
        })
      : phrases.VERDICT_FUNDED_NO_MC({ lifeExpectancy }),
  }
}

function buildStages(
  projection: CompositeProjectionResult,
  sym: string,
): JourneyStageRow[] {
  return projection.phases.map((phase) => {
    const rows = stageRows(projection, phase.planId)
    const first = rows[0]
    const last = rows[rows.length - 1]
    return {
      planId: phase.planId,
      name: phase.planName,
      ages: `${phase.fromAge}–${phase.toAge}`,
      firstYearSpend: first ? money(first.expenses, sym) : "—",
      endingBalance: last ? money(last.endingBalance, sym) : "—",
    }
  })
}

function buildAssumptions(
  projection: CompositeProjectionResult,
  ages: JourneyAges,
  sym: string,
): ReportRow[] {
  const rows: ReportRow[] = [
    { label: "Display currency", value: projection.displayCurrency },
    { label: "Independence age", value: String(ages.independenceAge) },
    { label: "Planning horizon", value: `age ${ages.lifeExpectancy}` },
  ]
  if (has(projection.targetBalance)) {
    rows.push({
      label: "Target ending balance",
      value: money(projection.targetBalance, sym),
    })
  }
  for (const phase of projection.phases) {
    const a = phase.assumptions
    if (!a) continue
    rows.push({
      label: phase.planName,
      value: phrases.JOURNEY_STAGE_ASSUMPTIONS({
        equity: percent(a.equityReturnRate * 100, 1),
        cash: percent(a.cashReturnRate * 100, 1),
        inflation: percent(a.inflationRate * 100, 1),
      }),
    })
  }
  return rows
}

export function buildJourneyReport(
  input: BuildJourneyReportInput,
): JourneyReportModel {
  const { journeyName, projection, mc, currencySymbol: sym } = input
  const ages = journeyAges(projection)
  const seed = mc && has(input.seed) ? input.seed : null
  const fiProgress = has(projection.fiProgress) ? projection.fiProgress : null
  return {
    cover: {
      title: "Independence analysis",
      journeyName,
      asOfDate: projection.asOfDate,
      currency: projection.displayCurrency,
      stageLine: phrases.JOURNEY_STAGE_COUNT({
        count: String(projection.phases.length),
      }),
      ageLine: phrases.AGE_LINE({
        currentAge: has(ages.currentAge) ? String(ages.currentAge) : "—",
        lifeExpectancy: String(ages.lifeExpectancy),
        retirementAge: String(ages.independenceAge),
      }),
    },
    verdict: buildVerdict(input, ages, sym),
    standing: {
      fiProgress,
      sentence:
        fiProgress !== null && has(projection.fiNumber)
          ? phrases.STANDING_PROGRESS_NO_AGE({
              // Behind-plan journeys can carry a negative fiProgress.
              fiProgress: percent(Math.max(0, fiProgress)),
              fiNumber: money(projection.fiNumber, sym),
            })
          : null,
    },
    stages: buildStages(projection, sym),
    stress: buildStress(
      mc,
      seed,
      {
        retirementAge: ages.independenceAge,
        lifeExpectancy: ages.lifeExpectancy,
      },
      sym,
    ),
    warnings: (projection.warnings ?? []).map(warningText),
    assumptions: buildAssumptions(projection, ages, sym),
    footer: {
      line: phrases.FOOTER({
        planName: journeyName,
        asOfDate: projection.asOfDate,
        templateVersion: REPORT_TEMPLATE_VERSION,
      }),
      disclaimer: phrases.DISCLAIMER(),
      templateVersion: REPORT_TEMPLATE_VERSION,
    },
  }
}
