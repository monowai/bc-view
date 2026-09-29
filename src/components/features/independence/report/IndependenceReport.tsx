import { currencySymbolFor } from "@lib/formatters"
import React, { useMemo } from "react"
import Link from "next/link"
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
  type ReportFinding,
  type ReportKpi,
  type ReportRow,
} from "@lib/independence/report/buildReport"
import VerdictBanner from "../VerdictBanner"
import LifestyleSummary from "../LifestyleSummary"
import TimelineTabContent from "../TimelineTabContent"
import { MonteCarloResultView } from "../monte-carlo/MonteCarloResultView"

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

const SEVERITY: Record<
  ReportFinding["severity"],
  { icon: string; color: string; label: string }
> = {
  CRITICAL: {
    icon: "fa-circle-exclamation",
    color: "text-red-600",
    label: "Critical",
  },
  WARNING: {
    icon: "fa-triangle-exclamation",
    color: "text-amber-600",
    label: "Warning",
  },
  POSITIVE: {
    icon: "fa-circle-check",
    color: "text-green-600",
    label: "Positive",
  },
  INFO: { icon: "fa-circle-info", color: "text-gray-500", label: "Note" },
}

/** Privacy mode hides money, not the shape of the report. */
const MONEY_PATTERNS = new Map<string, RegExp>()
function moneyPattern(symbol: string): RegExp {
  let re = MONEY_PATTERNS.get(symbol)
  if (!re) {
    const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    re = new RegExp(`-?${escaped}[\\d,.]+[mk]?`, "g")
    MONEY_PATTERNS.set(symbol, re)
  }
  return re
}
function maskMoney(text: string, symbol: string, hide: boolean): string {
  if (!hide) return text
  return text.replace(moneyPattern(symbol), "•••")
}

function Section({
  id,
  title,
  children,
  breakBefore = false,
}: {
  id: string
  title: string
  children: React.ReactNode
  breakBefore?: boolean
}): React.ReactElement {
  return (
    <section
      data-testid={`report-${id}`}
      className={`report-section rounded-lg border border-gray-200 bg-white p-5 ${
        breakBefore ? "report-break" : ""
      }`}
    >
      <h2 className="mb-2 text-lg font-semibold text-gray-900">{title}</h2>
      {children}
    </section>
  )
}

function Kpis({
  kpis,
  symbol,
  hide,
}: {
  kpis: ReportKpi[]
  symbol: string
  hide: boolean
}): React.ReactElement {
  return (
    <dl className="report-keep my-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {kpis.map((k) => (
        <div
          key={k.label}
          className="rounded-lg border border-gray-200 bg-gray-50 p-3"
        >
          <dt className="text-[11px] uppercase tracking-wide text-gray-500">
            {k.label}
          </dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
            {maskMoney(k.value, symbol, hide)}
          </dd>
          <dd className="text-xs text-gray-600">
            {maskMoney(k.caption, symbol, hide)}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function Rows({
  rows,
  symbol,
  hide,
}: {
  rows: ReportRow[]
  symbol: string
  hide: boolean
}): React.ReactElement {
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className="border-b border-gray-100">
            <td className="py-1 pr-3 text-gray-600">{r.label}</td>
            <td className="py-1 text-right tabular-nums text-gray-900">
              {maskMoney(r.value, symbol, hide)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
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
  // Three states, one level of JSX: ran, failed, not run.
  const stressBody = (ran: React.ReactNode): React.ReactNode => {
    if (model.stress && mc) return ran
    if (mcError) {
      return (
        <p className="text-red-700">
          Stress test failed: {mcError}. Reload the report to retry.
        </p>
      )
    }
    return (
      <p className="text-gray-600">
        Stress test not run. Open the plan and run the simulation, then print
        again.
      </p>
    )
  }
  const firstFinding = projection.findings?.[0]
  const fiProgress = projection.fiMetrics?.fiProgress
  const yearRows = [
    ...(projection.accumulationProjections ?? []).map((r) => ({
      key: `acc-${r.year}`,
      age: r.age,
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
      <div className="report-toolbar flex items-center justify-between print:hidden">
        <Link
          href={backHref ?? `/independence/plans/${plan.id}`}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          <i className="fas fa-arrow-left mr-1" aria-hidden="true" />
          Back to plan
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-700"
        >
          <i className="fas fa-print mr-1" aria-hidden="true" />
          Print / Save PDF
        </button>
      </div>

      {/* 0. Cover band */}
      <header
        data-testid="report-cover"
        className="report-cover report-keep grid grid-cols-[1fr_auto] gap-3 border-b-2 border-gray-900 pb-3"
      >
        <div>
          <h1 className="text-2xl font-bold">{model.cover.title}</h1>
          <div className="text-base text-gray-600">{model.cover.planName}</div>
          <div className="mt-1 text-gray-600">{model.cover.ageLine}</div>
        </div>
        <div className="text-right text-xs leading-6 text-gray-600">
          As of <b className="text-gray-900">{model.cover.asOfDate}</b>
          <br />
          <b className="text-gray-900">{model.cover.currency}</b> ·{" "}
          {model.cover.valueBasis}
          <br />
          Strategy <b className="text-gray-900">{model.cover.strategy}</b>
        </div>
      </header>

      {/* 1. Verdict */}
      <Section id="verdict" title="1. Verdict">
        {firstFinding && <VerdictBanner finding={firstFinding} />}
        <Kpis kpis={model.verdict.kpis} symbol={sym} hide={hideValues} />
        <p>{m(model.verdict.sentence)}</p>
      </Section>

      {/* 2. Where you stand */}
      <Section id="standing" title="2. Where you stand">
        {fiProgress !== undefined && (
          <div className="my-2">
            <div className="mb-1 flex justify-between text-xs text-gray-600">
              <span>Independence number progress</span>
              <span className="tabular-nums">{Math.round(fiProgress)}%</span>
            </div>
            <div className="flex h-3 overflow-hidden rounded bg-gray-100">
              <div
                data-testid="report-fi-bar"
                className={`h-full ${fiProgress >= 100 ? "bg-green-500" : "bg-independence-500"}`}
                style={{
                  width: `${Math.max(0, Math.min(100, Math.round(fiProgress)))}%`,
                }}
              />
            </div>
          </div>
        )}
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
      <Section id="stress" title="5. Stress test" breakBefore>
        {stressBody(
          <>
            <p className="mb-3">{m(model.stress?.sentence ?? "")}</p>
            {model.stress?.depletionLine && (
              <p className="mb-3 text-gray-700">{model.stress.depletionLine}</p>
            )}
            <MonteCarloResultView
              result={mc as MonteCarloResult}
              deterministicProjection={projection}
              currency={effectiveCurrency}
              hideValues={hideValues}
            />
            <h3 className="mt-4 mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Parameters
            </h3>
            <Rows
              rows={model.stress?.parameters ?? []}
              symbol={sym}
              hide={hideValues}
            />
          </>,
        )}
      </Section>

      {/* 6. Insights */}
      <Section id="insights" title="6. Insights">
        {model.insights.empty ? (
          <p className="text-gray-600">{model.insights.empty}</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {model.insights.findings.map((f) => {
              const s = SEVERITY[f.severity]
              return (
                <li key={f.code} className="report-keep flex gap-3 py-2">
                  <i
                    className={`fas ${s.icon} ${s.color} mt-0.5`}
                    aria-hidden="true"
                  />
                  <span
                    className={`w-16 shrink-0 text-xs font-semibold uppercase ${s.color}`}
                  >
                    {s.label}
                  </span>
                  <span>
                    <span className="font-medium">{f.title}</span>
                    {f.tag && (
                      <span className="ml-2 rounded border border-gray-300 px-1 text-[10px] text-gray-500 align-middle">
                        {f.tag}
                      </span>
                    )}
                    <div className="text-gray-600">{m(f.detail)}</div>
                    {f.gloss && (
                      <div className="text-xs text-gray-500">{f.gloss}</div>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
        {model.insights.warnings.length > 0 && (
          <>
            <h3 className="mt-3 mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Data notes
            </h3>
            <ul className="list-disc pl-5 text-gray-600">
              {model.insights.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </>
        )}
      </Section>

      {/* 7. Assumptions */}
      <Section id="assumptions" title="7. Assumptions">
        <Rows rows={model.assumptions} symbol={sym} hide={hideValues} />
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
              <th className="py-1 text-right">Starting</th>
              <th className="py-1 text-right">Growth</th>
              <th className="py-1 text-right">Income</th>
              <th className="py-1 text-right">Expenses</th>
              <th className="py-1 text-right">Ending</th>
              <th className="py-1 text-right">Total wealth</th>
            </tr>
          </thead>
          <tbody>
            {yearRows.map((r) => (
              <tr
                key={r.key}
                className="border-b border-gray-100 even:bg-gray-50"
              >
                <td className="py-0.5">{r.age}</td>
                <td className="py-0.5 text-right">
                  {m(money(r.starting, sym))}
                </td>
                <td className="py-0.5 text-right">{m(money(r.growth, sym))}</td>
                <td className="py-0.5 text-right">{m(money(r.income, sym))}</td>
                <td className="py-0.5 text-right">
                  {m(money(r.expenses, sym))}
                </td>
                <td className="py-0.5 text-right">{m(money(r.ending, sym))}</td>
                <td className="py-0.5 text-right">{m(money(r.total, sym))}</td>
              </tr>
            ))}
          </tbody>
        </table>

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
