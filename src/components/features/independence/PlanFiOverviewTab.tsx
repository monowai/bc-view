import React, { useMemo, useState } from "react"
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
} from "recharts"
import Spinner from "@components/ui/Spinner"
import type { RetirementPlan, RetirementProjection } from "types/independence"
import type { ScenarioState } from "./scenario/types"
import type { AssetBreakdown } from "./useAssetBreakdown"
import type { RentalIncomeData } from "./useUnifiedProjection"
import { useMonteCarloSimulation } from "./useMonteCarloSimulation"

const HIDDEN_VALUE = "****"
const MC_ITERATION_OPTIONS = [500, 1000, 2000, 5000]

function fmtShort(v: number, currency: string): string {
  const sym =
    currency === "USD"
      ? "$"
      : currency === "NZD"
        ? "NZ$"
        : currency === "SGD"
          ? "S$"
          : "$"
  if (v >= 1_000_000) return `${sym}${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `${sym}${(v / 1_000).toFixed(0)}K`
  return `${sym}${v.toLocaleString()}`
}

function fmtFull(v: number, currency: string): string {
  const sym =
    currency === "USD"
      ? "$"
      : currency === "NZD"
        ? "NZ$"
        : currency === "SGD"
          ? "S$"
          : "$"
  return `${sym}${Math.round(v).toLocaleString()}`
}

function fmtAxis(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`
  return String(v)
}

interface ChartRow {
  age: number
  year: number
  endingBalance: number
  p10Base?: number
  outerWidth?: number
  p25Base?: number
  innerWidth?: number
  p50?: number
}

function KpiCard({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string
  value: string
  sub?: string
  accent?: boolean
}): React.ReactElement {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-gray-500">{label}</span>
      <span
        className={`mt-0.5 text-2xl font-bold tabular-nums leading-none ${
          accent ? "text-green-600" : "text-gray-900"
        }`}
      >
        {value}
      </span>
      {sub && <span className="mt-1 text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

interface PlanFiOverviewTabProps {
  plan: RetirementPlan
  projection: RetirementProjection | null
  scenario: ScenarioState
  assets: AssetBreakdown
  monthlyInvestment: number
  rentalIncome: RentalIncomeData | undefined
  displayCurrency: string | undefined
  effectiveCurrency: string
  currentAge: number | undefined
  isCalculating: boolean
  hideValues: boolean
}

export default function PlanFiOverviewTab({
  plan,
  projection,
  scenario,
  assets,
  monthlyInvestment,
  rentalIncome,
  displayCurrency,
  effectiveCurrency,
  currentAge,
  isCalculating,
  hideValues,
}: PlanFiOverviewTabProps): React.ReactElement | null {
  const [mcIterations, setMcIterations] = useState(1000)

  const {
    result: mcResult,
    isRunning,
    error: mcError,
    runSimulation,
  } = useMonteCarloSimulation({
    plan,
    assets,
    monthlyInvestment,
    scenario,
    rentalIncome,
    displayCurrency,
  })

  const fiMetrics = projection?.fiMetrics
  const fiNumber = fiMetrics?.fiNumber ?? 0
  const currentLiquid = projection?.liquidAssets ?? 0
  const isAchieved = fiMetrics?.isFinanciallyIndependent ?? false

  // Build chart rows — merge MC bands when available
  const chartData = useMemo((): ChartRow[] => {
    if (!projection?.yearlyProjections?.length) return []
    const bandByYear = new Map(
      (mcResult?.yearlyBands ?? []).map((b) => [b.year, b]),
    )
    return projection.yearlyProjections.map((row) => {
      const band = bandByYear.get(row.year)
      return {
        age: row.age ?? 0,
        year: row.year,
        endingBalance: row.endingBalance,
        ...(band
          ? {
              p10Base: band.p10,
              outerWidth: Math.max(0, band.p90 - band.p10),
              p25Base: band.p25,
              innerWidth: Math.max(0, band.p75 - band.p25),
              p50: band.p50,
            }
          : {}),
      }
    })
  }, [projection, mcResult])

  const fiCrossingAge = useMemo(() => {
    if (fiNumber <= 0 || !chartData.length) return null
    return chartData.find((r) => r.endingBalance >= fiNumber)?.age ?? null
  }, [chartData, fiNumber])

  const gap = Math.abs(fiMetrics?.gapToFi ?? fiNumber - currentLiquid)
  const fiProgress =
    fiMetrics?.fiProgress ??
    (fiNumber > 0
      ? Math.min(100, Math.round((currentLiquid / fiNumber) * 100))
      : 100)

  const yrsToFi =
    fiCrossingAge != null && currentAge != null && fiCrossingAge > currentAge
      ? fiCrossingAge - currentAge
      : null

  // True when the trajectory crosses back below the FI line after having been above it.
  // Tells the user their return assumptions are below the implied 4% SWR.
  const dipsBelow = useMemo(() => {
    if (fiNumber <= 0 || !chartData.length) return false
    const firstAbove = chartData.findIndex((r) => r.endingBalance >= fiNumber)
    if (firstAbove === -1) return false
    return chartData
      .slice(firstAbove + 1)
      .some((r) => r.endingBalance < fiNumber)
  }, [chartData, fiNumber])

  const yMax = useMemo(() => {
    if (!chartData.length) return fiNumber * 1.2 || 1
    const maxBal = Math.max(
      ...chartData.map((r) =>
        Math.max(
          r.endingBalance,
          (r.p10Base ?? 0) + (r.outerWidth ?? 0),
          r.p50 ?? 0,
        ),
      ),
    )
    return Math.max(maxBal, fiNumber) * 1.1
  }, [chartData, fiNumber])

  const hasMc = Boolean(mcResult)
  const mcSuccessRate = mcResult?.successRate

  if (isCalculating && !projection) {
    return (
      <div className="py-12 flex justify-center">
        <Spinner label="Calculating projection…" size="lg" />
      </div>
    )
  }

  if (!projection) return null

  const handleRunMc = (): void => {
    void runSimulation(mcIterations)
  }

  return (
    <div className="space-y-6">
      {/* ——— KPI row ——— */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-5 pb-6 border-b border-gray-100">
        <KpiCard
          label="FI Target"
          value={
            hideValues ? HIDDEN_VALUE : fmtShort(fiNumber, effectiveCurrency)
          }
          sub="25× annual net spend"
        />
        <KpiCard
          label={isAchieved ? "Surplus" : "Gap to FI"}
          value={hideValues ? HIDDEN_VALUE : fmtShort(gap, effectiveCurrency)}
          sub={isAchieved ? "above target" : "remaining"}
          accent={isAchieved}
        />
        <KpiCard
          label={fiCrossingAge ? "FI at age" : "Runway"}
          value={
            fiCrossingAge
              ? String(fiCrossingAge)
              : projection.depletionAge == null
                ? "Sustainable"
                : `${projection.runwayYears ?? "—"} yrs`
          }
          sub={
            fiCrossingAge
              ? yrsToFi != null && yrsToFi > 0
                ? `${yrsToFi} year${yrsToFi !== 1 ? "s" : ""} away`
                : "Already achieved"
              : projection.depletionAge == null
                ? "To end of plan"
                : "Until depletion"
          }
          accent={isAchieved || fiCrossingAge != null}
        />
        <KpiCard
          label="Success Rate"
          value={hasMc ? `${mcSuccessRate!.toFixed(0)}%` : "—"}
          sub={
            hasMc
              ? `${mcResult!.iterations.toLocaleString()} MC runs`
              : "Run below"
          }
          accent={(mcSuccessRate ?? 0) >= 80}
        />
      </div>

      {/* ——— Progress bar ——— */}
      {fiNumber > 0 && (
        <div>
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="text-xs font-medium text-gray-600">
              Progress to FI
            </span>
            <span className="text-sm font-semibold tabular-nums text-gray-700">
              {hideValues ? "—" : `${Math.round(fiProgress)}%`}
            </span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                isAchieved ? "bg-green-500" : "bg-independence-500"
              }`}
              style={{ width: `${Math.min(100, Math.round(fiProgress))}%` }}
            />
          </div>
          {isAchieved && (
            <p className="text-xs text-green-600 mt-1.5 font-medium">
              <i className="fas fa-check-circle mr-1" />
              Portfolio covers your FI target — financial independence achieved.
            </p>
          )}
          {dipsBelow && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
              <i className="fas fa-info-circle mr-1.5" />
              Your projected returns are below the implied 4% safe withdrawal
              rate, so the trajectory may drift back below the FI line in later
              years. The Monte Carlo success rate gives a probability-weighted
              view.
            </p>
          )}
        </div>
      )}

      {/* ——— Trajectory chart ——— */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              Wealth Trajectory
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Liquid portfolio vs. FI target
              {hasMc ? " · with Monte Carlo confidence bands" : ""}
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-6 h-0.5 bg-slate-900 rounded" />
              Portfolio
            </span>
            {hasMc && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-5 h-3 rounded bg-green-100 border border-green-200" />
                p10–p90
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <svg width="24" height="10" viewBox="0 0 24 10">
                <line
                  x1="0"
                  y1="5"
                  x2="24"
                  y2="5"
                  stroke="#f97316"
                  strokeWidth="1.5"
                  strokeDasharray="6 4"
                />
              </svg>
              FI Target
            </span>
          </div>
        </div>

        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 4, right: 16, bottom: 20, left: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f1f5f9"
                vertical={false}
              />
              <XAxis
                dataKey="age"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                label={{
                  value: "Age",
                  position: "insideBottom",
                  offset: -10,
                  fontSize: 11,
                  fill: "#94a3b8",
                }}
              />
              <YAxis
                tickFormatter={hideValues ? () => "***" : fmtAxis}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                width={54}
                domain={[0, yMax]}
              />
              <ChartTooltip
                formatter={(val: any, name: any) => {
                  if (hideValues) return [HIDDEN_VALUE, name ?? ""]
                  const n = typeof val === "number" ? val : 0
                  return [fmtShort(n, effectiveCurrency), name ?? ""]
                }}
                labelFormatter={(age) => `Age ${age}`}
                contentStyle={{
                  fontSize: 12,
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  boxShadow: "0 4px 6px -1px rgba(0,0,0,.08)",
                  padding: "6px 10px",
                }}
              />

              {hasMc && (
                <>
                  <Area
                    type="monotone"
                    dataKey="p10Base"
                    fill="transparent"
                    stroke="none"
                    stackId="outer"
                    legendType="none"
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="outerWidth"
                    fill="rgba(34,197,94,0.09)"
                    stroke="none"
                    stackId="outer"
                    legendType="none"
                    isAnimationActive={false}
                    name="p10–p90"
                  />
                  <Area
                    type="monotone"
                    dataKey="p25Base"
                    fill="transparent"
                    stroke="none"
                    stackId="inner"
                    legendType="none"
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="innerWidth"
                    fill="rgba(34,197,94,0.15)"
                    stroke="none"
                    stackId="inner"
                    legendType="none"
                    isAnimationActive={false}
                    name="p25–p75"
                  />
                  <Line
                    type="monotone"
                    dataKey="p50"
                    stroke="rgba(34,197,94,0.55)"
                    strokeWidth={1.5}
                    strokeDasharray="5 4"
                    dot={false}
                    isAnimationActive={false}
                    name="Median (MC)"
                  />
                </>
              )}

              {fiCrossingAge && (
                <ReferenceArea
                  x1={fiCrossingAge}
                  fill="rgba(249,115,22,0.04)"
                  strokeOpacity={0}
                />
              )}

              {fiNumber > 0 && (
                <ReferenceLine
                  y={fiNumber}
                  stroke="#f97316"
                  strokeDasharray="6 4"
                  strokeWidth={1.5}
                  label={{
                    value: hideValues
                      ? "FI Target"
                      : `FI: ${fmtShort(fiNumber, effectiveCurrency)}`,
                    position: "insideTopRight",
                    fontSize: 11,
                    fill: "#f97316",
                    fontWeight: 600,
                  }}
                />
              )}

              {fiCrossingAge && (
                <ReferenceLine
                  x={fiCrossingAge}
                  stroke="#94a3b8"
                  strokeDasharray="4 3"
                  strokeWidth={1}
                  label={{
                    value: `Age ${fiCrossingAge}`,
                    position: "insideTopLeft",
                    fontSize: 11,
                    fill: "#64748b",
                    fontWeight: 500,
                  }}
                />
              )}

              <Line
                type="monotone"
                dataKey="endingBalance"
                stroke="#1e293b"
                strokeWidth={2.5}
                dot={false}
                isAnimationActive={false}
                name="Portfolio"
                activeDot={{
                  r: 4,
                  fill: "#1e293b",
                  stroke: "white",
                  strokeWidth: 2,
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ——— Monte Carlo ——— */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900">
              Monte Carlo Simulation
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Randomised market scenarios stress-test your projection.
              Confidence bands appear on the chart above.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <select
              value={mcIterations}
              onChange={(e) => setMcIterations(Number(e.target.value))}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
              aria-label="Simulation iterations"
            >
              {MC_ITERATION_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n.toLocaleString()} runs
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleRunMc}
              disabled={isRunning || !assets.hasAssets}
              className="px-4 py-1.5 text-sm font-medium bg-independence-600 text-white rounded-lg hover:bg-independence-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isRunning ? (
                <span className="flex items-center gap-1.5">
                  <i className="fas fa-spinner fa-spin text-xs" />
                  Running…
                </span>
              ) : hasMc ? (
                "Re-run"
              ) : (
                "Run Simulation"
              )}
            </button>
          </div>
        </div>

        {mcError && (
          <p className="mt-3 text-sm text-red-600">{mcError.message}</p>
        )}

        {hasMc && (
          <div className="mt-5 pt-4 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
            <KpiCard
              label="Success Rate"
              value={`${mcResult!.successRate.toFixed(1)}%`}
              sub="portfolio survives to end"
              accent={mcResult!.successRate >= 80}
            />
            <KpiCard
              label="Median End Balance"
              value={
                hideValues
                  ? HIDDEN_VALUE
                  : fmtShort(
                      mcResult!.terminalBalancePercentiles.p50,
                      effectiveCurrency,
                    )
              }
              sub="50th percentile outcome"
            />
            <KpiCard
              label="Worst 10% Outcome"
              value={
                hideValues
                  ? HIDDEN_VALUE
                  : fmtShort(
                      mcResult!.terminalBalancePercentiles.p10,
                      effectiveCurrency,
                    )
              }
              sub="10th percentile end balance"
            />
            <KpiCard
              label="Depletion Risk"
              value={
                mcResult!.depletionAgeDistribution.depletedCount > 0
                  ? `${((mcResult!.depletionAgeDistribution.depletedCount / mcResult!.iterations) * 100).toFixed(1)}%`
                  : "0%"
              }
              sub={
                mcResult!.depletionAgeDistribution.mostCommonDepletionAge
                  ? `typically age ${mcResult!.depletionAgeDistribution.mostCommonDepletionAge}`
                  : "all scenarios survive"
              }
              accent={
                mcResult!.depletionAgeDistribution.depletedCount === 0 ||
                mcResult!.depletionAgeDistribution.depletedCount /
                  mcResult!.iterations <
                  0.1
              }
            />
          </div>
        )}
      </div>

      {/* ——— Income breakdown ——— */}
      {fiMetrics && (
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <h3 className="text-xs font-semibold text-gray-600 mb-3">
            Monthly income &amp; FI number basis
          </h3>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm text-gray-600">
                Monthly retirement expenses
              </span>
              <span className="tabular-nums font-medium text-sm text-gray-700">
                {hideValues
                  ? HIDDEN_VALUE
                  : fmtFull(scenario.monthlyExpenses, effectiveCurrency)}
              </span>
            </div>
            {fiMetrics.totalMonthlyIncome > 0 && (
              <div className="flex items-baseline justify-between gap-2 pl-4">
                <span className="text-xs text-gray-500">
                  <span className="text-gray-400 mr-1.5">−</span>
                  Guaranteed income (pension + benefits + other)
                </span>
                <span className="tabular-nums font-medium text-sm text-green-600">
                  {hideValues
                    ? HIDDEN_VALUE
                    : `−${fmtFull(fiMetrics.totalMonthlyIncome, effectiveCurrency)}`}
                </span>
              </div>
            )}
            <div className="border-t border-gray-200 pt-2 mt-1 flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-gray-900">
                Net monthly portfolio need
              </span>
              <span className="tabular-nums font-medium text-base text-gray-900">
                {hideValues
                  ? HIDDEN_VALUE
                  : fmtFull(fiMetrics.netMonthlyExpenses, effectiveCurrency)}
              </span>
            </div>
            <p className="text-xs text-gray-500 pt-0.5">
              FI Number ={" "}
              {hideValues
                ? HIDDEN_VALUE
                : fmtShort(fiNumber, effectiveCurrency)}{" "}
              (25× annual net spend at the 4% rule)
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
