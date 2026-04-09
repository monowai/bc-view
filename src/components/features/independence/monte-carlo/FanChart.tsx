import React, { useState } from "react"
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { MonteCarloResult, RetirementProjection } from "types/independence"

const HIDDEN_VALUE = "****"

interface FanChartProps {
  yearlyBands: MonteCarloResult["yearlyBands"]
  deterministicProjection?: RetirementProjection
  currency: string
  hideValues: boolean
}

export function FanChart({
  yearlyBands,
  deterministicProjection,
  currency,
  hideValues,
}: FanChartProps): React.ReactElement | null {
  const [fanTooltipEnabled, setFanTooltipEnabled] = useState(true)

  const fanChartData = yearlyBands.map((band) => {
    const deterministicYear = deterministicProjection?.yearlyProjections?.find(
      (y) => y.year === band.year,
    )
    return {
      age: band.age ?? band.year,
      year: band.year,
      p5: band.p5,
      p10: band.p10,
      p25: band.p25,
      p50: band.p50,
      p75: band.p75,
      p90: band.p90,
      p95: band.p95,
      deterministic: deterministicYear?.endingBalance ?? null,
    }
  })

  const formatFullCurrency = (value: number): string => {
    if (hideValues) return HIDDEN_VALUE
    return `${currency}${Math.round(value).toLocaleString()}`
  }

  if (fanChartData.length === 0) return null

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Projected Balance Range
        </h3>
        <button
          type="button"
          onClick={() => setFanTooltipEnabled((v) => !v)}
          className={`text-xs px-2 py-1 rounded transition-colors ${
            fanTooltipEnabled
              ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
              : "bg-independence-100 text-independence-700 hover:bg-independence-200"
          }`}
          title={fanTooltipEnabled ? "Hide tooltip" : "Show tooltip"}
        >
          <i
            className={`fas ${fanTooltipEnabled ? "fa-eye-slash" : "fa-eye"} mr-1`}
          ></i>
          Tooltip
        </button>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={fanChartData}
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
            />
            <YAxis
              tickFormatter={(value) =>
                hideValues
                  ? HIDDEN_VALUE
                  : `${currency}${(value / 1000).toFixed(0)}k`
              }
              tick={{ fontSize: 12 }}
            />
            {fanTooltipEnabled && (
              <ChartTooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  // Hide tooltip when p50, p75, and p95 are all 0
                  const p50 = payload.find((p) => p.dataKey === "p50")?.value
                  const p75 = payload.find((p) => p.dataKey === "p75")?.value
                  const p95 = payload.find((p) => p.dataKey === "p95")?.value
                  if (
                    Number(p50 ?? 0) === 0 &&
                    Number(p75 ?? 0) === 0 &&
                    Number(p95 ?? 0) === 0
                  ) {
                    return null
                  }
                  const labels: Record<string, string> = {
                    p95: "95th percentile",
                    p90: "90th percentile",
                    p75: "75th percentile",
                    p50: "Median",
                    p25: "25th percentile",
                    p10: "10th percentile",
                    p5: "5th percentile",
                    deterministic: "Deterministic",
                  }
                  return (
                    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs max-w-xs">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-gray-700">
                          Age {label}
                        </span>
                        <button
                          type="button"
                          onClick={() => setFanTooltipEnabled(false)}
                          className="text-gray-400 hover:text-gray-600 ml-3 -mr-1"
                          title="Close tooltip"
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                      <div className="space-y-1">
                        {payload
                          .filter((p) => p.value != null)
                          .map((p) => {
                            const key = String(p.dataKey ?? "")
                            const isDeterministic = key === "deterministic"
                            return (
                              <div
                                key={key}
                                className="flex justify-between gap-3"
                              >
                                <span
                                  className={
                                    isDeterministic
                                      ? "text-blue-600"
                                      : "text-gray-600"
                                  }
                                >
                                  {labels[key] ?? key}
                                </span>
                                <span
                                  className={`font-medium ${isDeterministic ? "text-blue-700" : "text-gray-900"}`}
                                >
                                  {formatFullCurrency(Number(p.value ?? 0))}
                                </span>
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  )
                }}
              />
            )}
            <Legend
              formatter={(value: string) => {
                const labels: Record<string, string> = {
                  p95: "p5-p95 Band",
                  p75: "p25-p75 Band",
                  p50: "Median (p50)",
                  deterministic: "Deterministic",
                }
                return labels[value] ?? value
              }}
            />
            {/* Outer band: p5-p95 */}
            <Area
              dataKey="p95"
              stroke="none"
              fill="#fdba74"
              fillOpacity={0.3}
              name="p95"
            />
            <Area
              dataKey="p5"
              stroke="none"
              fill="#ffffff"
              fillOpacity={1}
              name="p5"
              legendType="none"
            />
            {/* Inner band: p25-p75 */}
            <Area
              dataKey="p75"
              stroke="none"
              fill="#f97316"
              fillOpacity={0.3}
              name="p75"
            />
            <Area
              dataKey="p25"
              stroke="none"
              fill="#ffffff"
              fillOpacity={1}
              name="p25"
              legendType="none"
            />
            {/* Median line */}
            <Line
              type="monotone"
              dataKey="p50"
              stroke="#ea580c"
              strokeWidth={2}
              dot={false}
              name="p50"
            />
            {/* Deterministic overlay */}
            <Line
              type="monotone"
              dataKey="deterministic"
              stroke="#3b82f6"
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
              name="deterministic"
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
