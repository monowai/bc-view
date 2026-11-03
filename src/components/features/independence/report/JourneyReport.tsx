import React, { useMemo } from "react"
import type {
  CompositeProjectionResult,
  MonteCarloResult,
  RetirementPlan,
} from "types/independence"
import { currencySymbolFor } from "@lib/formatters"
import { money } from "@lib/independence/report/buildReport"
import { buildJourneyReport } from "@lib/independence/report/buildJourneyReport"
import type { AssetBreakdown } from "../useAssetBreakdown"
import WealthOverTime from "../composite/WealthOverTime"
import { MonteCarloResultView } from "../monte-carlo/MonteCarloResultView"
import JourneyStageInsights from "./JourneyStageInsights"
import {
  DataNotes,
  FiProgressBar,
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
 * Independence analysis report for a whole journey — every stage stitched
 * end to end. Narrative and numbers come from `buildJourneyReport` (pure);
 * the wealth chart is the journey page's own, read from the composite
 * context the container provides. Per-stage findings come from each stage
 * plan projected on its own, since the composite carries none.
 *
 * Spec: bc-claude/INDEPENDENCE_REPORT.md.
 */
export interface JourneyReportProps {
  journeyName: string
  projection: CompositeProjectionResult
  mc: MonteCarloResult | null
  /** Seed sent with the Monte Carlo request; printed for reproducibility. */
  seed?: number
  /** Message from a failed Monte Carlo run; distinguishes failed from not run. */
  mcError?: string | null
  hideValues: boolean
  /** The journey's stage plans. Matched to stages by id. */
  stagePlans: RetirementPlan[]
  assets: AssetBreakdown
  backHref: string
}

export default function JourneyReport({
  journeyName,
  projection,
  mc,
  seed,
  mcError = null,
  hideValues,
  stagePlans,
  assets,
  backHref,
}: JourneyReportProps): React.ReactElement {
  const currency = projection.displayCurrency
  const sym = currencySymbolFor(currency)
  const model = useMemo(
    () =>
      buildJourneyReport({
        journeyName,
        projection,
        mc,
        currencySymbol: sym,
        seed,
      }),
    [journeyName, projection, mc, sym, seed],
  )
  const m = (s: string): string => maskMoney(s, sym, hideValues)
  const planById = new Map(stagePlans.map((p) => [p.id, p]))
  const stageName = new Map(
    projection.phases.map((p) => [p.planId, p.planName]),
  )
  // Accumulation rows carry the first stage's planId, but they are the
  // working years before any stage begins.
  const yearRows: YearTableRow[] = [
    ...(projection.accumulationProjections ?? []).map((r) => ({
      row: r,
      stage: "Before independence",
    })),
    ...projection.yearlyProjections.map((r) => ({
      row: r,
      stage: stageName.get(r.planId) ?? r.planName,
    })),
  ].map(({ row: r, stage }) => ({
    key: `${r.year}-${r.planId}`,
    age: r.age,
    stage,
    starting: r.startingBalance,
    growth: r.investmentReturns,
    income: r.income,
    expenses: r.expenses,
    ending: r.endingBalance,
    total: r.totalWealth,
  }))

  return (
    <div className="report mx-auto max-w-[760px] space-y-5 text-[13px] text-gray-900">
      <ReportToolbar backHref={backHref} backLabel="Back to your plan" />

      {/* 0. Cover band */}
      <ReportCover cover={model.cover} name={model.cover.journeyName}>
        {model.cover.stageLine}
      </ReportCover>

      {/* 1. Verdict */}
      <Section id="verdict" title="1. Verdict">
        <p className="text-base font-semibold">{model.verdict.headline}</p>
        <Kpis kpis={model.verdict.kpis} symbol={sym} hide={hideValues} />
        <p>{m(model.verdict.sentence)}</p>
      </Section>

      {/* 2. Where you stand */}
      <Section id="standing" title="2. Where you stand">
        {model.standing.fiProgress !== null && (
          <FiProgressBar fiProgress={model.standing.fiProgress} />
        )}
        {model.standing.sentence && <p>{m(model.standing.sentence)}</p>}
      </Section>

      {/* 3. Journey chart */}
      <Section id="journey" title="3. Your journey">
        <WealthOverTime />
      </Section>

      {/* 4. Stages */}
      <Section id="stages" title="4. Stages">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="border-b border-gray-300 text-left text-[10px] uppercase text-gray-500">
              <th className="py-1">Stage</th>
              <th className="py-1">Ages</th>
              <th className="py-1 text-right">First-year spending</th>
              <th className="py-1 text-right">Balance at end</th>
            </tr>
          </thead>
          <tbody>
            {model.stages.map((s) => (
              <tr key={s.planId} className="border-b border-gray-100">
                <td className="py-1">{s.name}</td>
                <td className="py-1">{s.ages}</td>
                <td className="py-1 text-right">{m(s.firstYearSpend)}</td>
                <td className="py-1 text-right">{m(s.endingBalance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* 5. Stress test */}
      <StressTestSection
        stress={model.stress}
        mc={mc}
        mcError={mcError}
        notRunMessage="Stress test not run. Reload the report to run it, then print again."
        mask={m}
        symbol={sym}
        hide={hideValues}
        renderResult={(result) => (
          <MonteCarloResultView
            result={result}
            currency={currency}
            hideValues={hideValues}
            showDeterministic={false}
          />
        )}
      />

      {/* 6. Stage by stage */}
      <Section id="stage-by-stage" title="6. Stage by stage">
        <div className="divide-y divide-gray-100">
          {model.stages.map((s, i) => {
            const plan = planById.get(s.planId)
            if (!plan) {
              return (
                <p key={s.planId} className="py-3 text-gray-600">
                  {s.name}: this stage&apos;s plan is not available.
                </p>
              )
            }
            return (
              <JourneyStageInsights
                key={s.planId}
                plan={plan}
                stageLabel={`Stage ${i + 1} · ${s.name} · ages ${s.ages}`}
                assets={assets}
                displayCurrency={currency}
                hideValues={hideValues}
              />
            )
          })}
        </div>
      </Section>

      {/* 7. Assumptions */}
      <Section id="assumptions" title="7. Assumptions">
        <Rows rows={model.assumptions} symbol={sym} hide={hideValues} />
        <DataNotes warnings={model.warnings} />
      </Section>

      {/* 8. Appendix */}
      <Section id="appendix" title="8. Appendix" breakBefore>
        <YearByYearTable
          rows={yearRows}
          showStage
          money={(value) => m(money(value, sym))}
        />

        <h3 className="mt-4 mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Method
        </h3>
        <p className="text-gray-600">
          <b>Journey projection.</b> Each stage runs its own plan — spending,
          income and assumptions — for the ages it covers, and hands its closing
          balances to the next stage. All figures are converted to {currency}.
        </p>
        <p className="text-gray-600">
          <b>Stress test.</b> The whole journey is re-run with annual returns
          drawn at each stage&apos;s mean and volatility, using the seed shown,
          so the result is reproducible. Success means liquid assets stay above
          zero to the planning horizon.
        </p>
        <p className="text-gray-600">
          <b>Stage by stage.</b> Findings and lifestyle for each stage come from
          that stage&apos;s plan projected on its own, from today. Read them as
          a check on the stage, not as the journey&apos;s answer.
        </p>

        <ReportFooter footer={model.footer} />
      </Section>
    </div>
  )
}
