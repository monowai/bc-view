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
  FiProgressBar,
  Kpis,
  ReportToolbar,
  Rows,
  Section,
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
  const yearRows = [
    ...(projection.accumulationProjections ?? []).map((r) => ({
      row: r,
      stage: "Before independence",
    })),
    ...projection.yearlyProjections.map((r) => ({
      row: r,
      stage: stageName.get(r.planId) ?? r.planName,
    })),
  ]
  // Three states, one level of JSX: ran, failed, not run.
  const stressBody = (
    ran: (result: MonteCarloResult) => React.ReactNode,
  ): React.ReactNode => {
    if (model.stress && mc) return ran(mc)
    if (mcError) {
      return (
        <p className="text-red-700">
          Stress test failed: {mcError}. Reload the report to retry.
        </p>
      )
    }
    return (
      <p className="text-gray-600">
        Stress test not run. Reload the report to run it, then print again.
      </p>
    )
  }

  return (
    <div className="report mx-auto max-w-[760px] space-y-5 text-[13px] text-gray-900">
      <ReportToolbar backHref={backHref} backLabel="Back to your plan" />

      {/* 0. Cover band */}
      <header
        data-testid="report-cover"
        className="report-cover report-keep grid grid-cols-[1fr_auto] gap-3 border-b-2 border-gray-900 pb-3"
      >
        <div>
          <h1 className="text-2xl font-bold">{model.cover.title}</h1>
          <div className="text-base text-gray-600">
            {model.cover.journeyName}
          </div>
          <div className="mt-1 text-gray-600">{model.cover.ageLine}</div>
        </div>
        <div className="text-right text-xs leading-6 text-gray-600">
          As of <b className="text-gray-900">{model.cover.asOfDate}</b>
          <br />
          <b className="text-gray-900">{model.cover.currency}</b>
          <br />
          {model.cover.stageLine}
        </div>
      </header>

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
      <Section id="stress" title="5. Stress test" breakBefore>
        {stressBody((result) => (
          <>
            <p className="mb-3">{m(model.stress?.sentence ?? "")}</p>
            {model.stress?.depletionLine && (
              <p className="mb-3 text-gray-700">{model.stress.depletionLine}</p>
            )}
            <MonteCarloResultView
              result={result}
              currency={currency}
              hideValues={hideValues}
              showDeterministic={false}
            />
            <h3 className="mt-4 mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Parameters
            </h3>
            <Rows
              rows={model.stress?.parameters ?? []}
              symbol={sym}
              hide={hideValues}
            />
          </>
        ))}
      </Section>

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
        {model.warnings.length > 0 && (
          <>
            <h3 className="mt-3 mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Data notes
            </h3>
            <ul className="list-disc pl-5 text-gray-600">
              {model.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </>
        )}
      </Section>

      {/* 8. Appendix */}
      <Section id="appendix" title="8. Appendix" breakBefore>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Year by year
        </h3>
        <table className="w-full text-xs tabular-nums">
          <thead>
            <tr className="border-b border-gray-300 text-left text-[10px] uppercase text-gray-500">
              <th className="py-1">Age</th>
              <th className="py-1">Stage</th>
              <th className="py-1 text-right">Starting</th>
              <th className="py-1 text-right">Growth</th>
              <th className="py-1 text-right">Income</th>
              <th className="py-1 text-right">Expenses</th>
              <th className="py-1 text-right">Ending</th>
              <th className="py-1 text-right">Total wealth</th>
            </tr>
          </thead>
          <tbody>
            {yearRows.map(({ row: r, stage }) => (
              <tr
                key={`${r.year}-${r.planId}`}
                className="border-b border-gray-100 even:bg-gray-50"
              >
                <td className="py-0.5">{r.age}</td>
                <td className="py-0.5">{stage}</td>
                <td className="py-0.5 text-right">
                  {m(money(r.startingBalance, sym))}
                </td>
                <td className="py-0.5 text-right">
                  {m(money(r.investmentReturns, sym))}
                </td>
                <td className="py-0.5 text-right">{m(money(r.income, sym))}</td>
                <td className="py-0.5 text-right">
                  {m(money(r.expenses, sym))}
                </td>
                <td className="py-0.5 text-right">
                  {m(money(r.endingBalance, sym))}
                </td>
                <td className="py-0.5 text-right">
                  {m(money(r.totalWealth, sym))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

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

        <footer
          data-testid="report-footer"
          className="mt-4 flex justify-between border-t border-gray-200 pt-2 text-[10px] text-gray-500"
        >
          <span>{model.footer.line}</span>
          <span>{model.footer.disclaimer}</span>
        </footer>
      </Section>
    </div>
  )
}
