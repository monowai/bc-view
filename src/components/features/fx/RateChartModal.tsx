import React, { useEffect } from "react"
import { useFxHistory } from "@hooks/useFxHistory"
import FxConverter from "@components/features/fx/FxConverter"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts"

// Time range options for chart
const TIME_RANGES = [
  { label: "1M", months: 1 },
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "1Y", months: 12 },
]

// Rate History Chart Modal Component
export interface RateChartModalProps {
  from: string
  to: string
  onClose: () => void
}

const RateChartModal: React.FC<RateChartModalProps> = ({
  from: initialFrom,
  to: initialTo,
  onClose,
}) => {
  const {
    chartData,
    stats,
    isLoading,
    error,
    months,
    setMonths,
    isInverted,
    setIsInverted,
  } = useFxHistory(initialFrom, initialTo)

  // Escape closes, as it does on every other modal.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  const from = isInverted ? initialTo : initialFrom
  const to = isInverted ? initialFrom : initialTo

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose}></div>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-auto z-50 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-500 px-6 py-4 text-white">
          <div className="flex items-center justify-between gap-4">
            {/* Currency pair */}
            <h2 className="text-xl font-bold flex items-center gap-2 shrink-0">
              <span>{from}</span>
              <button
                type="button"
                onClick={() => setIsInverted(!isInverted)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-all hover:scale-110"
                title="Swap currencies"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                  />
                </svg>
              </button>
              <span>{to}</span>
            </h2>

            {/* Quick Convert */}
            {stats && (
              <FxConverter from={from} to={to} rate={stats.current} compact />
            )}

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors shrink-0"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Time range selector */}
        <div className="px-6 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex gap-2">
            {TIME_RANGES.map((range) => (
              <button
                type="button"
                key={range.label}
                onClick={() => setMonths(range.months)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  months === range.months
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
          {stats && (
            <div className="flex items-center gap-4 text-sm">
              <span
                className={`font-medium ${stats.change >= 0 ? "text-green-600" : "text-red-600"}`}
              >
                {stats.change >= 0 ? "+" : ""}
                {stats.changePercent.toFixed(2)}%
              </span>
            </div>
          )}
        </div>

        {/* Chart area */}
        <div className="p-6">
          {isLoading && (
            <div className="h-64 flex items-center justify-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            </div>
          )}

          {error && (
            <div className="h-64 flex items-center justify-center text-red-500">
              Failed to load rate history
            </div>
          )}

          {!isLoading && !error && chartData.length === 0 && (
            <div className="h-64 flex items-center justify-center text-slate-500">
              {"No rate history for this range"}
            </div>
          )}

          {!isLoading && !error && chartData.length > 0 && (
            <>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      tickFormatter={(date: string) => {
                        const d = new Date(date)
                        return `${d.getDate()}/${d.getMonth() + 1}`
                      }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      domain={["auto", "auto"]}
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      tickFormatter={(value: number) => value.toFixed(3)}
                      width={60}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1e293b",
                        border: "none",
                        borderRadius: "8px",
                        color: "#fff",
                      }}
                      labelFormatter={(label) =>
                        new Date(String(label)).toLocaleDateString()
                      }
                      formatter={(value) =>
                        value !== undefined
                          ? [Number(value).toFixed(4), "Rate"]
                          : ["", ""]
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="rate"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 6, fill: "#3b82f6" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Stats */}
              {stats && (
                <div className="mt-4 grid grid-cols-4 gap-4">
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-slate-500 uppercase tracking-wide">
                      Current
                    </div>
                    <div className="text-lg font-bold text-slate-900 font-mono">
                      {stats.current.toFixed(4)}
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-slate-500 uppercase tracking-wide">
                      High
                    </div>
                    <div className="text-lg font-bold text-green-600 font-mono">
                      {stats.max.toFixed(4)}
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-slate-500 uppercase tracking-wide">
                      Low
                    </div>
                    <div className="text-lg font-bold text-red-600 font-mono">
                      {stats.min.toFixed(4)}
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-slate-500 uppercase tracking-wide">
                      Change
                    </div>
                    <div
                      className={`text-lg font-bold font-mono ${stats.change >= 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      {stats.change >= 0 ? "+" : ""}
                      {stats.change.toFixed(4)}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default RateChartModal
