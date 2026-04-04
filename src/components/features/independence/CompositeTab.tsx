import React from "react"
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from "recharts"
import type {
  RetirementPlan,
  UserIndependenceSettings,
  CompositeYearlyProjection,
} from "types/independence"
import { useCompositeProjection } from "@hooks/useCompositeProjection"
import { usePrivacyMode } from "@hooks/usePrivacyMode"
import PhaseConfigList from "./PhaseConfigList"
import Spinner from "@components/ui/Spinner"
import Alert from "@components/ui/Alert"

const HIDDEN_VALUE = "****"

// Distinct colours for up to 6 phases
const PHASE_COLORS = [
  { fill: "#3b82f6", stroke: "#2563eb", bg: "rgba(59,130,246,0.12)" }, // blue
  { fill: "#f97316", stroke: "#ea580c", bg: "rgba(249,115,22,0.12)" }, // orange
  { fill: "#22c55e", stroke: "#16a34a", bg: "rgba(34,197,94,0.12)" }, // green
  { fill: "#a855f7", stroke: "#9333ea", bg: "rgba(168,85,247,0.12)" }, // purple
  { fill: "#ec4899", stroke: "#db2777", bg: "rgba(236,72,153,0.12)" }, // pink
  { fill: "#14b8a6", stroke: "#0d9488", bg: "rgba(20,184,166,0.12)" }, // teal
]

interface CompositeTabProps {
  plans: RetirementPlan[]
  settings: UserIndependenceSettings | undefined
}

function formatMoney(
  value: number,
  currency: string,
  hide: boolean,
): string {
  if (hide) return HIDDEN_VALUE
  return `${currency} ${Math.round(value).toLocaleString()}`
}

export default function CompositeTab({
  plans,
  settings,
}: CompositeTabProps): React.ReactElement {
  const { hideValues } = usePrivacyMode()
  const {
    phases,
    setPhases,
    displayCurrency,
    setDisplayCurrency,
    excludedPlanIds,
    toggleExclusion,
    projection,
    scenarios,
    isLoading,
    error,
  } = useCompositeProjection(plans, settings)

  // Collect unique currencies from plans
  const currencies = Array.from(
    new Set(plans.map((p) => p.expensesCurrency).filter(Boolean)),
  )

  // Sustainability indicator
  const sustainabilityText = projection
    ? projection.isSustainable
      ? `Sustainable to age ${projection.yearlyProjections[projection.yearlyProjections.length - 1]?.age ?? "?"}`
      : `Depletes at age ${projection.depletionAge ?? "?"}`
    : null

  // Build chart data from projection
  const chartData = projection
    ? projection.yearlyProjections.map((row) => ({
        age: row.age,
        endingBalance: row.endingBalance,
        totalWealth: row.totalWealth,
        income: row.income,
        expenses: row.expenses,
        planId: row.planId,
        planName: row.planName,
      }))
    : []

  // Build phase boundary info for chart annotations
  const phaseBoundaries = projection
    ? projection.phases.map((phase, idx) => ({
        ...phase,
        color: PHASE_COLORS[idx % PHASE_COLORS.length],
      }))
    : []

  return (
    <div className="space-y-6">
      {/* Settings Bar */}
      <div className="bg-white rounded-xl shadow-md p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label
              htmlFor="composite-currency"
              className="text-sm font-medium text-gray-700"
            >
              Display Currency
            </label>
            <select
              id="composite-currency"
              value={displayCurrency}
              onChange={(e) => setDisplayCurrency(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
            >
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {sustainabilityText && (
            <span
              className={`ml-auto text-sm font-medium px-3 py-1 rounded-full ${
                projection?.isSustainable
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              <i
                className={`fas ${projection?.isSustainable ? "fa-check-circle" : "fa-exclamation-triangle"} mr-1`}
              ></i>
              {sustainabilityText}
            </span>
          )}
        </div>
      </div>

      {/* Phase Configuration */}
      <div className="bg-white rounded-xl shadow-md p-4">
        <PhaseConfigList
          plans={plans}
          phases={phases}
          onPhaseChange={setPhases}
          onExclude={toggleExclusion}
          excludedPlanIds={excludedPlanIds}
        />
      </div>

      {/* Loading / Error */}
      {isLoading && (
        <div className="text-center py-8">
          <Spinner label="Calculating composite projection..." size="lg" />
        </div>
      )}

      {error && <Alert>{error}</Alert>}

      {/* Wealth Journey Chart */}
      {!isLoading && projection && chartData.length > 0 && (
        <div className="bg-white rounded-xl shadow-md p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            <i className="fas fa-chart-line text-blue-500 mr-2"></i>
            Wealth Journey
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 10, right: 30, left: 20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="age"
                  label={{
                    value: "Age",
                    position: "insideBottom",
                    offset: -10,
                  }}
                  tick={{ fontSize: 12 }}
                  ticks={(() => {
                    const ages = chartData.map((d) => d.age)
                    if (ages.length === 0) return undefined
                    const minAge = Math.min(...ages)
                    const maxAge = Math.max(...ages)
                    const range = maxAge - minAge
                    const step = range <= 30 ? 5 : 10
                    const ticks: number[] = []
                    for (
                      let age = Math.ceil(minAge / step) * step;
                      age <= maxAge;
                      age += step
                    ) {
                      ticks.push(age)
                    }
                    // Include phase boundaries
                    for (const pb of phaseBoundaries) {
                      if (!ticks.includes(pb.fromAge)) ticks.push(pb.fromAge)
                    }
                    return ticks.sort((a, b) => a - b)
                  })()}
                />
                <YAxis
                  tickFormatter={(value) =>
                    hideValues
                      ? "****"
                      : `${displayCurrency} ${(value / 1000).toFixed(0)}k`
                  }
                  tick={{ fontSize: 12 }}
                />
                <ChartTooltip
                  formatter={(value, name) => {
                    const formatted = hideValues
                      ? HIDDEN_VALUE
                      : `${displayCurrency} ${Number(value || 0).toLocaleString()}`
                    if (name === "totalWealth") return [formatted, "Total Wealth"]
                    if (name === "endingBalance")
                      return [formatted, "Liquid Assets"]
                    return [formatted, String(name)]
                  }}
                  labelFormatter={(label) => {
                    const point = chartData.find((d) => d.age === label)
                    return point
                      ? `Age ${label} — ${point.planName}`
                      : `Age ${label}`
                  }}
                />
                <Legend
                  verticalAlign="top"
                  height={36}
                  formatter={(value: string) =>
                    value === "totalWealth"
                      ? "Total Wealth"
                      : value === "endingBalance"
                        ? "Liquid Assets"
                        : value
                  }
                />

                {/* Zero line */}
                <ReferenceLine y={0} stroke="#ef4444" strokeWidth={2} />

                {/* Phase background shading */}
                {phaseBoundaries.map((pb, idx) => (
                  <ReferenceArea
                    key={`phase-bg-${idx}`}
                    x1={pb.fromAge}
                    x2={pb.toAge}
                    fill={pb.color.fill}
                    fillOpacity={0.08}
                  />
                ))}

                {/* Phase boundary lines with labels */}
                {phaseBoundaries.map((pb, idx) =>
                  idx > 0 ? (
                    <ReferenceLine
                      key={`phase-line-${idx}`}
                      x={pb.fromAge}
                      stroke={pb.color.stroke}
                      strokeDasharray="5 5"
                      strokeWidth={2}
                      label={{
                        value: pb.planName,
                        position: "top",
                        fill: pb.color.stroke,
                        fontSize: 11,
                      }}
                    />
                  ) : null,
                )}

                {/* Total Wealth area (liquid + property) */}
                <Area
                  type="monotone"
                  dataKey="totalWealth"
                  fill="#22c55e"
                  fillOpacity={0.15}
                  stroke="#22c55e"
                  strokeWidth={1}
                  strokeDasharray="4 2"
                  dot={false}
                  name="totalWealth"
                />

                {/* Liquid assets line */}
                <Line
                  type="monotone"
                  dataKey="endingBalance"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={false}
                  name="endingBalance"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Phase legend */}
          <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-gray-100">
            {phaseBoundaries.map((pb, idx) => (
              <div key={idx} className="flex items-center gap-1.5 text-xs text-gray-600">
                <span
                  className="inline-block w-3 h-3 rounded-sm"
                  style={{ backgroundColor: pb.color.fill, opacity: 0.5 }}
                ></span>
                {pb.planName} ({pb.fromAge}–{pb.toAge})
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline Table */}
      {!isLoading && projection && (
        <div className="bg-white rounded-xl shadow-md p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Year-by-Year Timeline
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase">
                  <th className="py-2 px-2">Age</th>
                  <th className="py-2 px-2">Phase</th>
                  <th className="py-2 px-2 text-right">Starting</th>
                  <th className="py-2 px-2 text-right">Income</th>
                  <th className="py-2 px-2 text-right">Expenses</th>
                  <th className="py-2 px-2 text-right">Ending</th>
                </tr>
              </thead>
              <tbody>
                {projection.yearlyProjections.map(
                  (row: CompositeYearlyProjection, idx: number) => {
                    const isPhaseStart =
                      idx === 0 ||
                      row.planId !==
                        projection.yearlyProjections[idx - 1]?.planId
                    return (
                      <tr
                        key={`${row.year}-${row.planId}`}
                        className={`border-b border-gray-50 ${
                          isPhaseStart ? "border-t-2 border-t-independence-200" : ""
                        } ${row.endingBalance <= 0 ? "bg-red-50" : ""}`}
                      >
                        <td className="py-1.5 px-2 text-gray-600">
                          {row.age}
                        </td>
                        <td className="py-1.5 px-2 text-gray-700">
                          {isPhaseStart ? (
                            <span className="font-medium">{row.planName}</span>
                          ) : (
                            <span className="text-gray-400">&mdash;</span>
                          )}
                        </td>
                        <td className="py-1.5 px-2 text-right">
                          {formatMoney(
                            row.startingBalance,
                            displayCurrency,
                            hideValues,
                          )}
                        </td>
                        <td className="py-1.5 px-2 text-right text-green-600">
                          {formatMoney(row.income, displayCurrency, hideValues)}
                        </td>
                        <td className="py-1.5 px-2 text-right text-red-600">
                          {formatMoney(
                            row.expenses,
                            displayCurrency,
                            hideValues,
                          )}
                        </td>
                        <td
                          className={`py-1.5 px-2 text-right font-medium ${
                            row.endingBalance <= 0
                              ? "text-red-600"
                              : "text-gray-800"
                          }`}
                        >
                          {formatMoney(
                            row.endingBalance,
                            displayCurrency,
                            hideValues,
                          )}
                        </td>
                      </tr>
                    )
                  },
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Scenario Comparison */}
      {!isLoading && scenarios && scenarios.scenarios.length > 0 && (
        <div className="bg-white rounded-xl shadow-md p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Scenario Comparison
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase">
                  <th className="py-2 px-2">Scenario</th>
                  <th className="py-2 px-2 text-right">Runway (years)</th>
                  <th className="py-2 px-2 text-right">Depletion Age</th>
                  <th className="py-2 px-2 text-center">Sustainable</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.scenarios.map((s) => (
                  <tr
                    key={s.name}
                    className="border-b border-gray-50"
                  >
                    <td className="py-1.5 px-2">
                      <div className="font-medium text-gray-800">
                        {s.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {s.description}
                      </div>
                    </td>
                    <td className="py-1.5 px-2 text-right text-gray-700">
                      {hideValues
                        ? HIDDEN_VALUE
                        : s.projection.runwayYears.toFixed(1)}
                    </td>
                    <td className="py-1.5 px-2 text-right text-gray-700">
                      {hideValues
                        ? HIDDEN_VALUE
                        : s.projection.depletionAge ?? "Never"}
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      {s.projection.isSustainable ? (
                        <span className="text-green-600">
                          <i className="fas fa-check"></i>
                        </span>
                      ) : (
                        <span className="text-red-600">
                          <i className="fas fa-times"></i>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  )
}
