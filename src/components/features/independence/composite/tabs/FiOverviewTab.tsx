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
} from "recharts"
import ChartFrame from "@components/features/independence/ChartFrame"
import { ageAxisDomain, ageAxisTicks } from "@lib/independence/ageAxis"
import { deriveFiStack } from "@lib/independence/fiStack"
import Spinner from "@components/ui/Spinner"
import Alert from "@components/ui/Alert"
import { usePrivacyMode } from "@hooks/usePrivacyMode"
import { useIndependenceSettings } from "@hooks/useIndependenceSettings"
import { useCompositeProjectionContext } from "../CompositeProjectionContext"
import useCompositeMonteCarloSimulation from "@hooks/useCompositeMonteCarloSimulation"

const HIDDEN_VALUE = "****"
const MC_ITERATION_OPTIONS = [500, 1000, 2000, 5000]
const CURRENT_YEAR = new Date().getFullYear()

function fmtShort(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v.toLocaleString()}`
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

function IncomeRow({
  label,
  value,
  hideValues,
  indent = false,
  bold = false,
}: {
  label: string
  value: number
  hideValues: boolean
  indent?: boolean
  bold?: boolean
}): React.ReactElement {
  const isOffset = value < 0
  return (
    <div
      className={`flex items-baseline justify-between gap-2 ${indent ? "pl-4" : ""}`}
    >
      <span
        className={`${indent ? "text-xs text-gray-500" : "text-sm text-gray-600"} ${
          bold ? "font-semibold !text-gray-900" : ""
        }`}
      >
        {indent && <span className="text-gray-400 mr-1.5">−</span>}
        {label}
      </span>
      <span
        className={`tabular-nums font-medium ${
          bold ? "text-gray-900 text-base" : "text-sm"
        } ${isOffset ? "text-green-600" : "text-gray-700"}`}
      >
        {hideValues
          ? HIDDEN_VALUE
          : `${isOffset ? "−" : ""}$${Math.abs(value).toLocaleString()}`}
      </span>
    </div>
  )
}

export default function FiOverviewTab(): React.ReactElement | null {
  const { projection, plans, phases, displayCurrency, isLoading, error } =
    useCompositeProjectionContext()
  const { hideValues } = usePrivacyMode()
  const {
    result: mcResult,
    isRunning,
    error: mcError,
    runSimulation,
  } = useCompositeMonteCarloSimulation()
  const { settings } = useIndependenceSettings()
  const [mcIterations, setMcIterations] = useState(1000)

  // Primary plan for income/expense breakdown
  const primaryPlan = useMemo(
    () => plans.find((p) => p.isPrimary) ?? plans[0],
    [plans],
  )

  // Current age from independence settings, falling back to plan
  const currentAge = useMemo(() => {
    const yob = settings?.yearOfBirth ?? primaryPlan?.yearOfBirth
    return yob ? CURRENT_YEAR - yob : undefined
  }, [settings, primaryPlan])

  // Net monthly retirement expenses — for the income breakdown display only
  const netMonthlyExpenses = primaryPlan
    ? Math.max(
        0,
        primaryPlan.monthlyExpenses -
          (primaryPlan.pensionMonthly ?? 0) -
          (primaryPlan.socialSecurityMonthly ?? 0) -
          (primaryPlan.otherIncomeMonthly ?? 0),
      )
    : 0

  // Backend-authoritative FI number: phase-weighted 25× duration-weighted net spend,
  // rental-offset included. Falls back to 0 when old backend omits the field.
  const fiNumber = projection?.fiNumber ?? 0

  // Build chart rows — merge MC percentile bands when available
  const chartData = useMemo((): ChartRow[] => {
    if (!projection?.yearlyProjections) return []
    const bandByYear = new Map(
      (mcResult?.yearlyBands ?? []).map((b) => [b.year, b]),
    )
    return projection.yearlyProjections.map((row) => {
      const band = bandByYear.get(row.year)
      return {
        age: row.age,
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

  // First age where liquid balance crosses the FI target
  const fiCrossingAge = useMemo(() => {
    if (fiNumber <= 0 || !chartData.length) return null
    return chartData.find((r) => r.endingBalance >= fiNumber)?.age ?? null
  }, [chartData, fiNumber])

  // Always span current age → life expectancy (longest plan horizon in the
  // composite), even when the trajectory depletes earlier or runs past it.
  const ageAxis = useMemo(() => {
    const lifeExpectancy = plans.length
      ? Math.max(...plans.map((p) => p.lifeExpectancy))
      : undefined
    const [minAge, maxAge] = ageAxisDomain(
      currentAge,
      lifeExpectancy,
      chartData.map((r) => r.age),
    )
    return {
      domain: [minAge, maxAge] as [number, number],
      ticks: ageAxisTicks(
        minAge,
        maxAge,
        fiCrossingAge != null ? [fiCrossingAge] : [],
      ),
    }
  }, [chartData, currentAge, plans, fiCrossingAge])

  const currentLiquid = projection?.liquidAssets ?? 0
  const isAchieved = fiNumber > 0 && currentLiquid >= fiNumber
  // Backend-authoritative progress (unclamped — can exceed 100 when FI is surpassed).
  // Visual bar width is capped at 100% via Math.min in the style below.
  const fiProgress = Math.round(projection?.fiProgress ?? 0)
  const gap = fiNumber - currentLiquid

  // Stacked FI: portfolio (fiProgress) + guaranteed income (Social Security) as
  // its present value, over the same portfolio-only fiNumber. Overflow shown.
  const fiStack = deriveFiStack({
    fiProgress: projection?.fiProgress ?? 0,
    retirementAgeFiProgress: projection?.retirementAgeFiProgress ?? null,
  })

  const yrsToFi =
    fiCrossingAge != null && currentAge != null
      ? fiCrossingAge - currentAge
      : null

  // True when the trajectory crosses back below the FI line after having been above it.
  const dipsBelow = useMemo(() => {
    if (fiNumber <= 0 || !chartData.length) return false
    const firstAbove = chartData.findIndex((r) => r.endingBalance >= fiNumber)
    if (firstAbove === -1) return false
    return chartData
      .slice(firstAbove + 1)
      .some((r) => r.endingBalance < fiNumber)
  }, [chartData, fiNumber])

  // Y-axis upper bound — headroom above both fiNumber and max projected balance
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

  // ——————————————————————————————————————
  // Render
  // ——————————————————————————————————————

  if (isLoading) {
    return (
      <div className="py-12 flex justify-center">
        <Spinner label="Computing projection…" size="lg" />
      </div>
    )
  }

  if (error) return <Alert>{error}</Alert>
  if (!projection) return null

  const handleRunMc = (): void => {
    void runSimulation({ iterations: mcIterations, phases, displayCurrency })
  }

  return (
    <div className="space-y-6">
      {/* ——— Key metrics ——— */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-5 pb-6 border-b border-gray-100">
        <KpiCard
          label="FI Target"
          value={hideValues ? HIDDEN_VALUE : fmtShort(fiNumber)}
          sub="25× annual net spend"
        />
        <KpiCard
          label={isAchieved ? "Surplus" : "Gap to FI"}
          value={hideValues ? HIDDEN_VALUE : fmtShort(Math.abs(gap))}
          sub={isAchieved ? "above target" : "remaining"}
          accent={isAchieved}
        />
        <KpiCard
          label={fiCrossingAge ? "FI at age" : "Runway"}
          value={
            fiCrossingAge
              ? String(fiCrossingAge)
              : projection.runwayYears > 50
                ? "50+ yrs"
                : `${projection.runwayYears} yrs`
          }
          sub={
            fiCrossingAge
              ? yrsToFi != null && yrsToFi > 0
                ? `${yrsToFi} year${yrsToFi !== 1 ? "s" : ""} away`
                : "Already achieved"
              : projection.isSustainable
                ? "Sustainable to end"
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

      {/* ——— FI progress bar ——— */}
      {fiNumber > 0 && (
        <div>
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="text-xs font-medium text-gray-600">
              Progress to FI
            </span>
            <span className="text-sm font-semibold tabular-nums text-gray-700">
              {hideValues ? "—" : `${fiProgress}%`}
            </span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden flex">
            <div
              className={`h-full transition-all duration-700 ${
                isAchieved ? "bg-green-500" : "bg-independence-500"
              }`}
              style={{
                width: hideValues ? "0%" : `${Math.min(100, fiProgress)}%`,
              }}
            />
            {fiStack.hasIncome && (
              <div
                className="h-full bg-amber-400 transition-all duration-700"
                style={{ width: hideValues ? "0%" : `${fiStack.incomePct}%` }}
                title="Guaranteed income (Social Security), credited as the present value of the future stream"
              />
            )}
          </div>
          {fiStack.hasIncome && (
            <div className="mt-1.5 flex items-center justify-between gap-3 flex-wrap text-xs">
              <span className="flex items-center gap-3 text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-sm bg-independence-500" />
                  Portfolio
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-sm bg-amber-400" />
                  + Social Security
                </span>
              </span>
              <span
                className={`font-semibold ${
                  fiStack.achieved ? "text-green-600" : "text-gray-700"
                }`}
              >
                {fiStack.achieved ? "✓ " : ""}
                {hideValues ? "—" : `${Math.round(fiStack.totalProgress)}%`}
                <span className="ml-1 font-normal text-gray-500">
                  incl. income
                </span>
              </span>
            </div>
          )}
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

      {/* ——— Wealth trajectory chart ——— */}
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
          {/* Inline legend */}
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
            {hasMc && (
              <span className="flex items-center gap-1.5">
                <svg width="24" height="10" viewBox="0 0 24 10">
                  <line
                    x1="0"
                    y1="5"
                    x2="24"
                    y2="5"
                    stroke="rgba(34,197,94,0.6)"
                    strokeWidth="1.5"
                    strokeDasharray="5 4"
                  />
                </svg>
                Median
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

        <ChartFrame heightClass="h-64 sm:h-80">
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
              type="number"
              scale="linear"
              domain={ageAxis.domain}
              ticks={ageAxis.ticks}
              allowDataOverflow
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
                return [fmtShort(n), name ?? ""]
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

            {/* MC outer band p10–p90 */}
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
                {/* MC inner band p25–p75 */}
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
                {/* MC p50 median trace */}
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

            {/* Post-FI success zone */}
            {fiCrossingAge && (
              <ReferenceArea
                x1={fiCrossingAge}
                fill="rgba(249,115,22,0.04)"
                strokeOpacity={0}
              />
            )}

            {/* FI target reference line */}
            {fiNumber > 0 && (
              <ReferenceLine
                y={fiNumber}
                stroke="#f97316"
                strokeDasharray="6 4"
                strokeWidth={1.5}
                label={{
                  value: hideValues
                    ? "FI Target"
                    : `FI Target: ${fmtShort(fiNumber)}`,
                  position: "insideTopRight",
                  fontSize: 11,
                  fill: "#f97316",
                  fontWeight: 600,
                }}
              />
            )}

            {/* Vertical crosshair at FI crossing age */}
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

            {/* Main deterministic trajectory */}
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
        </ChartFrame>
      </div>

      {/* ——— Monte Carlo section ——— */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900">
              Monte Carlo Simulation
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Simulates random market scenarios to stress-test your projection.
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
              disabled={isRunning || phases.length === 0}
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

        {mcError && <Alert className="mt-3">{mcError.message}</Alert>}

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
                  : fmtShort(mcResult!.terminalBalancePercentiles.p50)
              }
              sub="50th percentile outcome"
            />
            <KpiCard
              label="Worst 10% Outcome"
              value={
                hideValues
                  ? HIDDEN_VALUE
                  : fmtShort(mcResult!.terminalBalancePercentiles.p10)
              }
              sub="10th percentile end balance"
            />
            <KpiCard
              label="Depletion Risk"
              value={
                mcResult!.depletionAgeDistribution.depletedCount > 0
                  ? `${(
                      (mcResult!.depletionAgeDistribution.depletedCount /
                        mcResult!.iterations) *
                      100
                    ).toFixed(1)}%`
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

      {/* ——— Monthly income breakdown ——— */}
      {primaryPlan && (
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <h3 className="text-xs font-semibold text-gray-600 mb-3">
            Monthly income & FI number basis
          </h3>
          <div className="space-y-2">
            <IncomeRow
              label="Monthly retirement expenses"
              value={primaryPlan.monthlyExpenses}
              hideValues={hideValues}
            />
            {(primaryPlan.pensionMonthly ?? 0) > 0 && (
              <IncomeRow
                label="Pension income"
                value={-primaryPlan.pensionMonthly!}
                hideValues={hideValues}
                indent
              />
            )}
            {(primaryPlan.socialSecurityMonthly ?? 0) > 0 && (
              <IncomeRow
                label="Government benefits"
                value={-primaryPlan.socialSecurityMonthly!}
                hideValues={hideValues}
                indent
              />
            )}
            {(primaryPlan.otherIncomeMonthly ?? 0) > 0 && (
              <IncomeRow
                label="Other income"
                value={-primaryPlan.otherIncomeMonthly!}
                hideValues={hideValues}
                indent
              />
            )}
            <div className="border-t border-gray-200 pt-2 mt-1">
              <IncomeRow
                label="Net monthly portfolio need"
                value={netMonthlyExpenses}
                hideValues={hideValues}
                bold
              />
            </div>
            <p className="text-xs text-gray-500 pt-0.5">
              FI Number = {hideValues ? HIDDEN_VALUE : fmtShort(fiNumber)} (25×
              annual net spend at the 4% rule)
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
