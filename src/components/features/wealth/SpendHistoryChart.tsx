import React, { useState } from "react"
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { SpendEntry } from "types/independence"
import {
  type SpendHistoryRow,
  type SpendSeries,
  formatSpendTick,
  spendHistory,
} from "@lib/independence/spendHistory"

const TICK = { fontSize: 11, fill: "#94a3b8" }
const BUDGET_COLOR = "#334155"
const PROJECTED_COLOR = "#64748b"
const SURFACE = "#ffffff"
/** Estimated months: same hue, lighter, so identity holds and the state reads. */
const ESTIMATED_OPACITY = 0.4

interface SpendHistoryChartProps {
  entries: SpendEntry[]
  /** Monthly budget by category label id. */
  budgets: Record<string, number>
  /** `YYYY-MM`, oldest first. */
  months: string[]
  currencySymbol: string
}

function shortMonth(month: string): string {
  const [y, m] = month.split("-").map(Number)
  return new Date(y, m - 1, 1).toLocaleString("en-US", {
    month: "short",
    year: "numeric",
  })
}

function HistoryTooltip({
  active,
  payload,
  series,
  money,
}: {
  active?: boolean
  payload?: Array<{ payload: SpendHistoryRow }>
  series: SpendSeries[]
  money: (n: number) => string
}): React.ReactElement | null {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  return (
    <div className="rounded border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 font-semibold text-gray-900">
        {shortMonth(row.month)}
      </p>
      {row.actual == null ? (
        <p className="text-gray-500">Nothing recorded</p>
      ) : row.estimated ? (
        <>
          <p className="text-gray-500">Estimated (not recorded)</p>
          <p className="flex gap-2 font-medium text-gray-900">
            Actual
            <span className="ml-auto tabular-nums">{money(row.actual)}</span>
          </p>
        </>
      ) : (
        <>
          {series
            .filter((s) => typeof row[s.key] === "number")
            .map((s) => (
              <p key={s.key} className="flex items-center gap-2 text-gray-700">
                <span
                  className="inline-block h-2 w-2 rounded-sm"
                  style={{ backgroundColor: s.color }}
                />
                {s.name}
                <span className="ml-auto tabular-nums">
                  {money(row[s.key] as number)}
                </span>
              </p>
            ))}
          <p className="mt-1 flex gap-2 border-t border-gray-100 pt-1 font-medium text-gray-900">
            Actual
            <span className="ml-auto tabular-nums">{money(row.actual)}</span>
          </p>
          {row.budget != null && (
            <p className="flex gap-2 text-gray-600">
              Budget
              <span className="ml-auto tabular-nums">{money(row.budget)}</span>
            </p>
          )}
        </>
      )}
      {row.projected != null && (
        <p className="flex gap-2 text-gray-600">
          Projected
          <span className="ml-auto tabular-nums">{money(row.projected)}</span>
        </p>
      )}
    </div>
  )
}

/**
 * Monthly spend over time: actual stacked by the largest categories, against
 * the budget of the categories recorded (step line) and the projection
 * (dashed). One money axis. Legend and table always available, since three
 * category hues sit under 3:1 contrast.
 */
export default function SpendHistoryChart({
  entries,
  budgets,
  months,
  currencySymbol,
}: SpendHistoryChartProps): React.ReactElement {
  const [showTable, setShowTable] = useState(false)
  const { series, rows } = spendHistory(entries, budgets, months)
  const money = (n: number): string =>
    `${n < 0 ? "-" : ""}${currencySymbol}${Math.abs(Math.round(n)).toLocaleString()}`

  if (series.length === 0 && rows.every((r) => r.projected == null)) {
    return (
      <p className="py-8 text-center text-sm text-gray-500">
        No spend recorded yet.
      </p>
    )
  }

  return (
    <div>
      <ul
        aria-label="Legend"
        className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600"
      >
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: s.color }}
            />
            {s.name}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-4"
            style={{ backgroundColor: BUDGET_COLOR }}
          />
          Budget
        </li>
        <li className="flex items-center gap-1.5">
          <span
            className="inline-block h-0 w-4 border-t-2 border-dashed"
            style={{ borderColor: PROJECTED_COLOR }}
          />
          Projected
        </li>
        {rows.some((r) => r.estimated) && (
          <li className="text-gray-500">Lighter bars are estimated</li>
        )}
      </ul>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={rows}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#f1f5f9"
              vertical={false}
            />
            <XAxis
              dataKey="month"
              tickFormatter={shortMonth}
              tick={TICK}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={formatSpendTick}
              tick={TICK}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <Tooltip
              cursor={{ fill: "#f8fafc" }}
              content={<HistoryTooltip series={series} money={money} />}
            />
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.name}
                stackId="actual"
                fill={s.color}
                stroke={SURFACE}
                strokeWidth={2}
                maxBarSize={28}
                radius={i === series.length - 1 ? [4, 4, 0, 0] : 0}
                isAnimationActive={false}
              >
                {rows.map((r) => (
                  <Cell
                    key={r.month}
                    fillOpacity={r.estimated ? ESTIMATED_OPACITY : 1}
                  />
                ))}
              </Bar>
            ))}
            <Line
              dataKey="budget"
              name="Budget"
              type="stepAfter"
              stroke={BUDGET_COLOR}
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Line
              dataKey="projected"
              name="Projected"
              stroke={PROJECTED_COLOR}
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={{
                r: 4,
                fill: PROJECTED_COLOR,
                stroke: SURFACE,
                strokeWidth: 2,
              }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <button
        type="button"
        onClick={() => setShowTable((v) => !v)}
        className="mt-2 rounded-sm text-xs text-wealth-600 hover:text-wealth-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-wealth-500"
      >
        {showTable ? "Hide table" : "Show table"}
      </button>
      {showTable && (
        <table className="mt-2 min-w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              {["Month", "Actual", "Budget", "Projected", "Against budget"].map(
                (h) => (
                  <th
                    key={h}
                    className="px-2 py-1 text-right font-medium uppercase text-gray-500 first:text-left"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 tabular-nums">
            {rows.map((r) => (
              <tr key={r.month}>
                <th
                  scope="row"
                  className="px-2 py-1 text-left font-normal text-gray-900"
                >
                  {shortMonth(r.month)}
                </th>
                <td className="px-2 py-1 text-right">
                  {r.actual == null
                    ? "—"
                    : `${money(r.actual)}${r.estimated ? " est." : ""}`}
                </td>
                <td className="px-2 py-1 text-right">
                  {r.budget == null ? "—" : money(r.budget)}
                </td>
                <td className="px-2 py-1 text-right">
                  {r.projected == null ? "—" : money(r.projected)}
                </td>
                <td className="px-2 py-1 text-right">
                  {r.actual == null || r.budget == null
                    ? "—"
                    : money(r.actual - r.budget)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
