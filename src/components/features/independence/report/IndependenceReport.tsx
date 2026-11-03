import { currencySymbolFor } from "@lib/formatters"
import React, { useMemo } from "react"
import type {
  MonteCarloResult,
  RetirementPlan,
  RetirementProjection,
} from "types/independence"
import type { LifestyleSummaryModel } from "@lib/independence/lifestyleSummary"
import {
  buildReport,
  money,
  type ReportAges,
} from "@lib/independence/report/buildReport"
import VerdictBanner from "../VerdictBanner"
import LifestyleSummary from "../LifestyleSummary"
import TimelineTabContent from "../TimelineTabContent"
import { MonteCarloResultView } from "../monte-carlo/MonteCarloResultView"
import {
  DataNotes,
  FiProgressBar,
  FindingsList,
  Kpis,
  ReportCover,
  ReportFooter,
  ReportToolbar,
  Rows,
  Section,
  StressTestSection,
  YearByYearTable,
  type YearTableRow,
  maskMoney,
} from "./reportParts"

/**
 * Independence analysis report — the printable, deterministic statement of
 * one plan. Narrative and numbers come from `buildReport` (pure); charts are
 * the same components the plan page renders, fed the same projection.
 *
 * Spec: bc-claude/INDEPENDENCE_REPORT.md. Mock:
 * bc-claude/playgrounds/independence-report.html.
 */
export interface IndependenceReportProps {
  plan: RetirementPlan
  projection: RetirementProjection
  baselineProjection: RetirementProjection | null
  mc: MonteCarloResult | null
  /** Seed sent with the Monte Carlo request; printed for reproducibility. */
  seed?: number
  ages: ReportAges
  /** Display currency ISO code, e.g. "SGD". Symbol derived via currencySymbolFor. */
  effectiveCurrency: string
  hideValues: boolean
  lifestyle: LifestyleSummaryModel | null
  /** Message from a failed Monte Carlo run; distinguishes failed from not run. */
  mcError?: string | null
  /** Where "Back to plan" goes. Defaults to the plan page. */
  backHref?: string
}

export default function IndependenceReport({
  plan,
  projection,
  baselineProjection,
  mc,
  seed,
  ages,
  effectiveCurrency,
  hideValues,
  lifestyle,
  mcError = null,
  backHref,
}: IndependenceReportProps): React.ReactElement {
  const model = useMemo(
    () =>
      buildReport({
        plan,
        projection,
        mc,
        ages,
        currencySymbol: currencySymbolFor(effectiveCurrency),
        seed,
      }),
    [plan, projection, mc, ages, effectiveCurrency, seed],
  )
  const sym = currencySymbolFor(effectiveCurrency)
  const m = (s: string): string => maskMoney(s, sym, hideValues)
  const firstFinding = projection.findings?.[0]
  const fiProgress = projection.fiMetrics?.fiProgress
  const yearRows: YearTableRow[] = [
    ...(projection.accumulationProjections ?? []).map((r) => ({
      key: `acc-${r.year}`,
      age: r.age ?? "—",
      starting: r.startingBalance,
      growth: r.investmentGrowth,
      income: r.contribution,
      expenses: 0,
      ending: r.endingBalance,
      total: r.totalWealth,
    })),
    ...projection.yearlyProjections.map((r) => ({
      key: `ret-${r.year}`,
      age: r.age ?? "—",
      starting: r.startingBalance,
      growth: r.investment,
      income: r.incomeBreakdown?.totalIncome ?? 0,
      expenses: r.inflationAdjustedExpenses,
      ending: r.endingBalance,
      total: r.totalWealth ?? 0,
    })),
  ]

  return (
    <div className="report mx-auto max-w-[760px] space-y-5 text-[13px] text-gray-900">
      <ReportToolbar
        backHref={backHref ?? `/independence/plans/${plan.id}`}
        backLabel="Back to plan"
      />

      {/* 0. Cover band */}
      <ReportCover
        cover={model.cover}
        name={model.cover.planName}
        currencyNote={model.cover.valueBasis}
      >
        Strategy <b className="text-gray-900">{model.cover.strategy}</b>
      </ReportCover>

      {/* 1. Verdict */}
      <Section id="verdict" title="1. Verdict">
        {firstFinding && <VerdictBanner finding={firstFinding} />}
        <Kpis kpis={model.verdict.kpis} symbol={sym} hide={hideValues} />
        <p>{m(model.verdict.sentence)}</p>
      </Section>

      {/* 2. Where you stand */}
      <Section id="standing" title="2. Where you stand">
        {fiProgress !== undefined && <FiProgressBar fiProgress={fiProgress} />}
        {model.standing.sentence && <p>{m(model.standing.sentence)}</p>}
      </Section>

      {/* 3. Lifestyle */}
      <Section id="lifestyle" title="3. Lifestyle">
        <LifestyleSummary
          model={lifestyle}
          currencySymbol={sym}
          hideValues={hideValues}
          variant="panel"
          emptyMessage={`No expenses recorded. The plan uses ${m(
            money(projection.monthlyExpenses, sym),
          )} a month.`}
        />
      </Section>

      {/* 4. Journey (wealth journey + cash flows + income table) */}
      <Section id="journey" title="4. Your journey">
        <ul
          data-testid="report-milestones"
          className="mb-3 list-disc pl-5 text-gray-700"
        >
          {model.journey.milestones.map((line) => (
            <li key={line}>{m(line)}</li>
          ))}
        </ul>
        <TimelineTabContent
          projection={projection}
          baselineProjection={baselineProjection}
          retirementAge={ages.retirementAge}
          lifeExpectancy={ages.lifeExpectancy}
          hideValues={hideValues}
          isCalculating={false}
          effectiveCurrency={effectiveCurrency}
        />
      </Section>

      {/* 5. Stress test */}
      <StressTestSection
        stress={model.stress}
        mc={mc}
        mcError={mcError}
        notRunMessage="Stress test not run. Open the plan and run the simulation, then print again."
        mask={m}
        symbol={sym}
        hide={hideValues}
        renderResult={(result) => (
          <MonteCarloResultView
            result={result}
            deterministicProjection={projection}
            currency={effectiveCurrency}
            hideValues={hideValues}
          />
        )}
      />

      {/* 6. Insights */}
      <Section id="insights" title="6. Insights">
        {model.insights.empty ? (
          <p className="text-gray-600">{model.insights.empty}</p>
        ) : (
          <FindingsList findings={model.insights.findings} mask={m} />
        )}
        <DataNotes warnings={model.insights.warnings} />
      </Section>

      {/* 7. Assumptions */}
      <Section id="assumptions" title="7. Assumptions">
        <Rows rows={model.assumptions} symbol={sym} hide={hideValues} />
      </Section>

      {/* 8. Appendix */}
      <Section id="appendix" title="8. Appendix" breakBefore>
        <YearByYearTable
          rows={yearRows}
          money={(value) => m(money(value, sym))}
        />

        <h3 className="mt-4 mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Method
        </h3>
        <p className="text-gray-600">
          <b>Deterministic projection.</b> Each year grows opening balances at
          the expected return, adds contributions and income, deducts
          inflation-indexed expenses and draws the shortfall from liquid assets
          in the configured withdrawal order. Non-spendable assets are carried
          at their assumed growth and released only at the stated sale age.
        </p>
        <p className="text-gray-600">
          <b>Stress test.</b> The same engine is re-run with annual returns
          drawn at the stated mean and volatility, using the seed shown, so the
          result is reproducible. Success means liquid assets stay above zero to
          the planning horizon.
        </p>
        <p className="text-gray-600">
          <b>Value basis.</b> All amounts are in {model.cover.valueBasis} unless
          a stream is marked otherwise.
        </p>

        <h3 className="mt-4 mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Glossary
        </h3>
        <p className="text-gray-600">
          <b>Independence number</b> — annual planned spending divided by the
          safe withdrawal rate. <b>Coast FI</b> — the point where existing
          assets grow to the independence number with no further contributions.{" "}
          <b>Runway</b> — years the plan stays funded from the as-of date.{" "}
          <b>Sustainable spend</b> — the largest level monthly spend that lasts
          to the horizon. <b>Bridge window</b> — years between independence and
          the first guaranteed income. <b>Annuitised</b> — wealth converted to a
          lifetime income stream and no longer sellable.
        </p>

        <ReportFooter footer={model.footer} />
      </Section>
    </div>
  )
}
