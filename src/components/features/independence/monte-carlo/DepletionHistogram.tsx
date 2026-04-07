import React from "react"
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
} from "recharts"
import { MonteCarloResult } from "types/independence"

const HIDDEN_VALUE = "****"

interface DepletionHistogramProps {
  distribution: MonteCarloResult["depletionAgeDistribution"]
  iterations: number
  hideValues: boolean
}

export function DepletionHistogram({
  distribution,
  iterations,
  hideValues,
}: DepletionHistogramProps): React.ReactElement | null {
  const histogramData = (() => {
    const sorted = Object.entries(distribution.histogram)
      .map(([age, count]) => ({ age: Number(age), count }))
      .sort((a, b) => a.age - b.age)
    const depletedCount = distribution.depletedCount
    let cumulative = 0
    return sorted.map((entry) => {
      cumulative += entry.count
      return {
        ...entry,
        pctOfTotal: (entry.count / iterations) * 100,
        pctOfDepleted:
          depletedCount > 0 ? (entry.count / depletedCount) * 100 : 0,
        cumulativeCount: cumulative,
        cumulativePctOfDepleted:
          depletedCount > 0 ? (cumulative / depletedCount) * 100 : 0,
      }
    })
  })()

  if (distribution.depletedCount <= 0 || histogramData.length === 0) {
    return null
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Depletion Age Distribution
      </h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={histogramData}
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
              tick={{ fontSize: 12 }}
              label={{
                value: "Iterations",
                angle: -90,
                position: "insideLeft",
                offset: -5,
              }}
            />
            <ChartTooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const entry = histogramData.find(
                  (d) => d.age === Number(label),
                )
                if (!entry) return null
                if (hideValues) {
                  return (
                    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
                      <div className="font-semibold text-gray-700 mb-1">
                        Age {label}
                      </div>
                      <div>{HIDDEN_VALUE}</div>
                    </div>
                  )
                }
                // Find depleted path summaries for this age
                const paths =
                  distribution.depletedPaths?.filter(
                    (p) => p.depletionAge === Number(label),
                  ) || []
                return (
                  <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs max-w-xs">
                    <div className="font-semibold text-gray-700 mb-2">
                      Depleted at age {label}
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between gap-4">
                        <span className="text-gray-600">
                          Iterations
                        </span>
                        <span className="font-medium text-red-700">
                          {entry.count.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-gray-600">
                          % of all iterations
                        </span>
                        <span className="font-medium text-gray-900">
                          {entry.pctOfTotal.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-gray-600">
                          % of depleted
                        </span>
                        <span className="font-medium text-gray-900">
                          {entry.pctOfDepleted.toFixed(1)}%
                        </span>
                      </div>
                      <div className="border-t border-gray-100 pt-1 mt-1 flex justify-between gap-4">
                        <span className="text-gray-600">
                          Cumulative by age {label}
                        </span>
                        <span className="font-medium text-gray-900">
                          {entry.cumulativeCount.toLocaleString()} (
                          {entry.cumulativePctOfDepleted.toFixed(0)}%)
                        </span>
                      </div>
                    </div>
                    {/* Realized return details for depleted paths at this age */}
                    {paths.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <div className="font-semibold text-gray-600 mb-1">
                          Realized returns (
                          {paths.length === 1
                            ? "1 path"
                            : `avg of ${paths.length} paths`}
                          )
                        </div>
                        {(() => {
                          const avgReturn =
                            paths.reduce(
                              (s, p) => s + p.averageReturn,
                              0,
                            ) / paths.length
                          const worstReturn = Math.min(
                            ...paths.map((p) => p.worstReturn),
                          )
                          const avgInflation =
                            paths.reduce(
                              (s, p) => s + p.averageInflation,
                              0,
                            ) / paths.length
                          const worstInflation = Math.max(
                            ...paths.map((p) => p.worstInflation),
                          )
                          return (
                            <div className="space-y-1">
                              <div className="flex justify-between gap-4">
                                <span className="text-gray-600">
                                  Avg return p.a.
                                </span>
                                <span className="font-medium text-gray-900">
                                  {(avgReturn * 100).toFixed(2)}%
                                </span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-gray-600">
                                  Worst year return
                                </span>
                                <span className="font-medium text-red-700">
                                  {(worstReturn * 100).toFixed(2)}%
                                </span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-gray-600">
                                  Avg inflation p.a.
                                </span>
                                <span className="font-medium text-gray-900">
                                  {(avgInflation * 100).toFixed(2)}%
                                </span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-gray-600">
                                  Worst year inflation
                                </span>
                                <span className="font-medium text-red-700">
                                  {(worstInflation * 100).toFixed(2)}%
                                </span>
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    )}
                    {paths.length === 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-100 text-gray-500">
                        Worst-case return sequences depleted funds by
                        this age
                      </div>
                    )}
                  </div>
                )
              }}
            />
            <Bar
              dataKey="count"
              fill="#ef4444"
              fillOpacity={0.7}
              name="Depleted"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
