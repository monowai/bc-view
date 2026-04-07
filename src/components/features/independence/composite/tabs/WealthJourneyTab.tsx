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
import Spinner from "@components/ui/Spinner"
import Alert from "@components/ui/Alert"
import { usePrivacyMode } from "@hooks/usePrivacyMode"
import { useCompositeProjectionContext } from "../CompositeProjectionContext"

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

/**
 * Wealth Journey tab — renders the composite projection chart with
 * total-wealth area, liquid-assets line, and phase boundary annotations.
 * Reads all state from {@link useCompositeProjectionContext}.
 */
export default function WealthJourneyTab(): React.ReactElement {
  const { hideValues } = usePrivacyMode()
  const { displayCurrency, projection, isLoading, error } =
    useCompositeProjectionContext()

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <Spinner label="Calculating composite projection..." size="lg" />
      </div>
    )
  }

  if (error) {
    return <Alert>{error}</Alert>
  }

  if (!projection) {
    return null as unknown as React.ReactElement
  }

  const chartData = projection.yearlyProjections.map((row) => ({
    age: row.age,
    endingBalance: row.endingBalance,
    totalWealth: row.totalWealth,
    income: row.income,
    expenses: row.expenses,
    planId: row.planId,
    planName: row.planName,
  }))

  if (chartData.length === 0) {
    return null as unknown as React.ReactElement
  }

  const phaseBoundaries = projection.phases.map((phase, idx) => ({
    ...phase,
    color: PHASE_COLORS[idx % PHASE_COLORS.length],
  }))

  return (
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
          <div
            key={idx}
            className="flex items-center gap-1.5 text-xs text-gray-600"
          >
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ backgroundColor: pb.color.fill, opacity: 0.5 }}
            ></span>
            {pb.planName} ({pb.fromAge}–{pb.toAge})
          </div>
        ))}
      </div>
    </div>
  )
}
