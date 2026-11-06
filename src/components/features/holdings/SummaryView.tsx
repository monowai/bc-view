import React, { useMemo, useState, useCallback } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
} from "recharts"
import { Holdings, SubTotalValues } from "types/beancounter"
import { FormatValue } from "@components/ui/MoneyUtils"
import { ProgressBar } from "@components/ui/ProgressBar"
import {
  AllocationSlice,
  GroupingMode,
} from "@lib/allocation/aggregateHoldings"
import { getGroupComparator } from "@lib/categoryMapping"
import { formatPercent } from "@lib/formatters"
import { useDisplayCurrencyConversion } from "@lib/hooks/useDisplayCurrencyConversion"

// Color palette for report categories
const CATEGORY_COLORS: Record<string, string> = {
  Equity: "#3B82F6", // blue
  ETF: "#10B981", // green
  "Mutual Fund": "#8B5CF6", // purple
  Cash: "#6B7280", // gray
  Property: "#F59E0B", // amber
}

const FALLBACK_COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#6366F1",
]

// Get color for alpha progress bar based on IRR performance
const getAlphaColor = (irr: number): "blue" | "green" | "purple" | "gray" => {
  if (irr >= 0.15) return "green" // 15%+ = green (excellent)
  if (irr >= 0.08) return "blue" // 8-15% = blue (good)
  if (irr >= 0.03) return "purple" // 3-8% = purple (fair)
  return "gray" // <3% = gray (poor)
}

interface SummaryViewProps {
  holdings: Holdings
  allocationData: AllocationSlice[]
  groupBy: GroupingMode
}

const signClass = (value: number): string =>
  value > 0 ? "text-green-600" : value < 0 ? "text-red-600" : "text-gray-900"

/** Direction never rests on colour alone: a caret and a sign go with it. */
const Direction: React.FC<{ value: number }> = ({ value }) =>
  value === 0 ? null : (
    <i
      aria-hidden="true"
      className={`fas ${value > 0 ? "fa-caret-up" : "fa-caret-down"} mr-1`}
    ></i>
  )

const sign = (value: number): string => (value > 0 ? "+" : value < 0 ? "-" : "")

const Money: React.FC<{
  value: number
  currencySymbol: string
  signed?: boolean
}> = ({ value, currencySymbol, signed = false }) => (
  <>
    {signed && <Direction value={value} />}
    {signed ? sign(value) : value < 0 ? "-" : ""}
    {currencySymbol}
    <FormatValue value={Math.abs(value)} />
  </>
)

const Percent: React.FC<{ value: number }> = ({ value }) => (
  <>
    <Direction value={value} />
    {`${sign(value)}${formatPercent(Math.abs(value))}`}
  </>
)

interface FigureProps {
  label: string
  children: React.ReactNode
  /** Size and colour of the value. */
  valueClass: string
}

const Figure: React.FC<FigureProps> = ({ label, children, valueClass }) => (
  <div className="min-w-0">
    <dt className="text-xs font-medium tracking-wide text-gray-500">{label}</dt>
    <dd
      className={`mt-1 whitespace-nowrap font-mono font-semibold tabular-nums ${valueClass}`}
    >
      {children}
    </dd>
  </div>
)

interface TooltipPayload {
  name: string
  value: number
  payload: { name: string; [key: string]: number | string }
  color: string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayload[]
  currencySymbol: string
  totalValue: number
}

const CustomBarTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  currencySymbol,
  totalValue,
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
        {payload.map((entry, index) => {
          const percentage =
            totalValue > 0 ? (entry.value / totalValue) * 100 : 0
          return (
            <div key={index} className="flex items-center space-x-2 mb-1">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-gray-700">{entry.name}:</span>
              <span className="font-medium">
                {currencySymbol}
                <FormatValue value={entry.value} />
              </span>
              <span className="text-gray-500">({percentage.toFixed(1)}%)</span>
            </div>
          )
        })}
      </div>
    )
  }
  return null
}

type ChartType = "none" | "bar" | "donut"

const CHART_VIEWS: { type: ChartType; label: string; icon: string }[] = [
  { type: "none", label: "Table only", icon: "fa-table-list" },
  { type: "bar", label: "Bar chart", icon: "fa-bars-progress" },
  { type: "donut", label: "Donut chart", icon: "fa-chart-pie" },
]

const SummaryView: React.FC<SummaryViewProps> = ({
  holdings,
  allocationData,
  groupBy,
}) => {
  const [excludedCategories, setExcludedCategories] = useState<Set<string>>(
    new Set(),
  )
  const [chartType, setChartType] = useState<ChartType>("none")

  // Source currency is always the trade currency (what the values are denominated in)
  const sourceCurrency = holdings.viewTotals?.currency || holdings.currency

  // Use shared hook for display currency conversion
  const {
    convert,
    currencySymbol: effectiveCurrencySymbol,
    currencyCode: effectiveCurrencyCode,
  } = useDisplayCurrencyConversion({
    sourceCurrency,
    portfolio: holdings.portfolio,
  })

  const handleToggleCategory = useCallback((category: string) => {
    setExcludedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }, [])

  // Get the viewTotals based on valueIn
  const viewTotals: SubTotalValues = holdings.viewTotals

  // Filter allocation data and sort by predefined order
  const filteredAllocation = useMemo(() => {
    const sorter = getGroupComparator(groupBy)
    return allocationData
      .filter((slice) => !excludedCategories.has(slice.key))
      .sort((a, b) => sorter(a.key, b.key))
  }, [allocationData, excludedCategories, groupBy])

  // Calculate filtered total (with FX conversion)
  const filteredTotal = useMemo(() => {
    return filteredAllocation.reduce(
      (sum, slice) => sum + convert(slice.value),
      0,
    )
  }, [filteredAllocation, convert])

  const filteredGainOnDay = useMemo(
    () =>
      filteredAllocation.reduce(
        (sum, slice) => sum + convert(slice.gainOnDay),
        0,
      ),
    [filteredAllocation, convert],
  )
  const isFiltered = excludedCategories.size > 0

  // Transform data for stacked bar chart - single row with all categories (with FX conversion)
  const barData = useMemo(() => {
    const dataPoint: Record<string, number | string> = { name: "Allocation" }
    filteredAllocation.forEach((slice) => {
      dataPoint[slice.key] = convert(slice.value)
    })
    return [dataPoint]
  }, [filteredAllocation, convert])

  // Get colors for each category
  const getColor = (key: string, index: number): string => {
    return (
      CATEGORY_COLORS[key] || FALLBACK_COLORS[index % FALLBACK_COLORS.length]
    )
  }

  return (
    <div className="space-y-6">
      {/* Total first: market value leads, the movers sit beside it and the
          ledger of flows follows. One surface, not a grid of cards. */}
      <section
        aria-label="Portfolio figures"
        className="rounded-lg border border-gray-200 bg-white"
      >
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 p-5 md:grid-cols-[minmax(0,1fr)_auto_auto_auto] md:items-end md:gap-x-10">
          <div className="col-span-2 md:col-span-1">
            <Figure
              label="Market Value"
              valueClass="text-2xl tracking-tight text-gray-900 sm:text-3xl"
            >
              <Money
                value={convert(viewTotals.marketValue)}
                currencySymbol={effectiveCurrencySymbol}
              />
              <span className="ml-2 font-sans text-sm font-medium tracking-normal text-gray-500">
                {effectiveCurrencyCode}
              </span>
            </Figure>
          </div>
          <Figure
            label="Gain on Day"
            valueClass={`text-lg ${signClass(viewTotals.gainOnDay)}`}
          >
            <Money
              value={convert(viewTotals.gainOnDay)}
              currencySymbol={effectiveCurrencySymbol}
              signed
            />
          </Figure>
          <Figure
            label="Total Gain"
            valueClass={`text-lg ${signClass(viewTotals.totalGain)}`}
          >
            <Money
              value={convert(viewTotals.totalGain)}
              currencySymbol={effectiveCurrencySymbol}
              signed
            />
          </Figure>
          <Figure
            label="IRR"
            valueClass={`text-lg ${signClass(holdings.totals.irr)}`}
          >
            <Percent value={holdings.totals.irr} />
          </Figure>
        </dl>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-gray-100 px-5 py-4 sm:grid-cols-3 lg:grid-cols-5">
          <Figure label="Dividends" valueClass="text-sm text-gray-900">
            <Money
              value={convert(viewTotals.dividends)}
              currencySymbol={effectiveCurrencySymbol}
            />
          </Figure>
          <Figure label="Purchases" valueClass="text-sm text-gray-900">
            <Money
              value={convert(viewTotals.purchases)}
              currencySymbol={effectiveCurrencySymbol}
            />
          </Figure>
          <Figure label="Sales" valueClass="text-sm text-gray-900">
            <Money
              value={convert(viewTotals.sales)}
              currencySymbol={effectiveCurrencySymbol}
            />
          </Figure>
          <Figure
            label="Realised Gain"
            valueClass={`text-sm ${signClass(viewTotals.realisedGain)}`}
          >
            <Money
              value={convert(viewTotals.realisedGain)}
              currencySymbol={effectiveCurrencySymbol}
              signed
            />
          </Figure>
          <Figure
            label="Unrealised Gain"
            valueClass={`text-sm ${signClass(viewTotals.unrealisedGain)}`}
          >
            <Money
              value={convert(viewTotals.unrealisedGain)}
              currencySymbol={effectiveCurrencySymbol}
              signed
            />
          </Figure>
        </dl>
      </section>

      {/* Asset Allocation Chart */}
      <section
        aria-labelledby="allocation-heading"
        className="rounded-lg border border-gray-200 bg-white p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h3
            id="allocation-heading"
            className="text-lg font-semibold text-gray-900"
          >
            {"Asset Allocation"}
          </h3>
          <div
            role="group"
            aria-label="Allocation view"
            className="flex items-center gap-0.5 rounded-lg bg-gray-100 p-0.5"
          >
            {CHART_VIEWS.map((view) => (
              <button
                key={view.type}
                type="button"
                onClick={() => setChartType(view.type)}
                aria-label={view.label}
                aria-pressed={chartType === view.type}
                title={view.label}
                className={`rounded-md px-2 py-1 text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600 ${
                  chartType === view.type
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                <i aria-hidden="true" className={`fas ${view.icon}`}></i>
              </button>
            ))}
          </div>
        </div>

        {chartType === "bar" && (
          <div className="h-16 mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={barData}
                layout="vertical"
                margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
              >
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" hide />
                <Tooltip
                  content={
                    <CustomBarTooltip
                      currencySymbol={effectiveCurrencySymbol}
                      totalValue={filteredTotal}
                    />
                  }
                />
                {filteredAllocation.map((slice, index) => (
                  <Bar
                    key={slice.key}
                    dataKey={slice.key}
                    stackId="allocation"
                    fill={getColor(slice.key, index)}
                    radius={
                      index === 0
                        ? [4, 0, 0, 4]
                        : index === filteredAllocation.length - 1
                          ? [0, 4, 4, 0]
                          : [0, 0, 0, 0]
                    }
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {chartType === "donut" && (
          <div className="h-64 mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={filteredAllocation.map((slice, index) => ({
                    ...slice,
                    fill: getColor(slice.key, index),
                  }))}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="label"
                />
                <Tooltip
                  content={
                    <CustomBarTooltip
                      currencySymbol={effectiveCurrencySymbol}
                      totalValue={filteredTotal}
                    />
                  }
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Allocation Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-2 py-2 text-xs font-medium tracking-wide text-gray-500 text-left">
                  {"Group"}
                </th>
                <th className="px-2 py-2 text-xs font-medium tracking-wide text-gray-500 text-right">
                  {"Market Value"}
                </th>
                <th className="px-2 py-2 text-xs font-medium tracking-wide text-gray-500 text-right">
                  {"Gain on Day"}
                </th>
                <th className="px-2 py-2 text-xs font-medium tracking-wide text-gray-500 text-right">
                  {"IRR"}
                </th>
                <th className="px-2 py-2 text-xs font-medium tracking-wide text-gray-500 hidden text-center md:table-cell">
                  {"Alpha"}
                </th>
                <th className="px-2 py-2 text-xs font-medium tracking-wide text-gray-500 text-right">
                  {"Weight"}
                </th>
              </tr>
            </thead>
            <tbody>
              {[...allocationData]
                .sort((a, b) => getGroupComparator(groupBy)(a.key, b.key))
                .map((slice, index) => {
                  const isExcluded = excludedCategories.has(slice.key)
                  const convertedValue = convert(slice.value)
                  const convertedGainOnDay = convert(slice.gainOnDay)
                  const percentage =
                    filteredTotal > 0 && !isExcluded
                      ? (convertedValue / filteredTotal) * 100
                      : 0
                  const muted = "text-gray-400"

                  return (
                    // The row is the mouse target; the button in the first
                    // cell gives keyboard users the same toggle (its click
                    // bubbles here, so a press toggles once).
                    <tr
                      key={slice.key}
                      className={`cursor-pointer border-b border-gray-100 transition-colors duration-150 hover:bg-gray-50 ${
                        isExcluded ? "opacity-50" : ""
                      }`}
                      onClick={() => handleToggleCategory(slice.key)}
                    >
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          aria-pressed={!isExcluded}
                          title={
                            isExcluded
                              ? `Include ${slice.label} in the totals`
                              : `Leave ${slice.label} out of the totals`
                          }
                          className="flex items-center rounded text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                        >
                          <span
                            aria-hidden="true"
                            className={`mr-2 h-3 w-3 shrink-0 rounded-sm ${isExcluded ? "bg-gray-300" : ""}`}
                            style={{
                              backgroundColor: isExcluded
                                ? undefined
                                : getColor(slice.key, index),
                            }}
                          />
                          <span
                            className={
                              isExcluded
                                ? "text-gray-500 line-through"
                                : "text-gray-900"
                            }
                          >
                            {slice.label}
                          </span>
                        </button>
                      </td>
                      <td
                        className={`px-2 py-2 text-right font-mono tabular-nums ${isExcluded ? muted : "text-gray-900"}`}
                      >
                        <Money
                          value={convertedValue}
                          currencySymbol={effectiveCurrencySymbol}
                        />
                      </td>
                      <td
                        className={`px-2 py-2 text-right font-mono tabular-nums ${isExcluded ? muted : signClass(convertedGainOnDay)}`}
                      >
                        <Money
                          value={convertedGainOnDay}
                          currencySymbol={effectiveCurrencySymbol}
                          signed
                        />
                      </td>
                      <td
                        className={`px-2 py-2 text-right font-mono tabular-nums ${isExcluded ? muted : signClass(slice.irr)}`}
                      >
                        <Percent value={slice.irr} />
                      </td>
                      <td className="hidden px-2 py-2 md:table-cell">
                        <ProgressBar
                          value={Math.abs(slice.irr)}
                          maxValue={0.3}
                          showLabel={false}
                          size="sm"
                          color={isExcluded ? "gray" : getAlphaColor(slice.irr)}
                        />
                      </td>
                      <td
                        className={`px-2 py-2 text-right font-mono tabular-nums ${isExcluded ? muted : "text-gray-600"}`}
                      >
                        {isExcluded ? "-" : `${percentage.toFixed(1)}%`}
                      </td>
                    </tr>
                  )
                })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 font-semibold">
                <td className="px-2 py-2 text-gray-700">
                  {isFiltered ? "Filtered Total" : "Total"}
                </td>
                <td className="px-2 py-2 text-right font-mono tabular-nums text-gray-900">
                  <Money
                    value={filteredTotal}
                    currencySymbol={effectiveCurrencySymbol}
                  />
                </td>
                <td
                  className={`px-2 py-2 text-right font-mono tabular-nums ${signClass(filteredGainOnDay)}`}
                >
                  <Money
                    value={filteredGainOnDay}
                    currencySymbol={effectiveCurrencySymbol}
                    signed
                  />
                </td>
                {/* The IRR is the whole portfolio's; it says nothing about
                    a total with groups left out. */}
                <td
                  className={`px-2 py-2 text-right font-mono tabular-nums ${isFiltered ? "text-gray-500" : signClass(holdings.totals.irr)}`}
                  title={
                    isFiltered
                      ? "IRR covers the whole portfolio, not a filtered total"
                      : undefined
                  }
                >
                  {isFiltered ? "—" : <Percent value={holdings.totals.irr} />}
                </td>
                <td className="hidden px-2 py-2 md:table-cell" />
                <td className="px-2 py-2 text-right font-mono tabular-nums text-gray-600">
                  {"100%"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          {"Select a group to leave it out of the totals."}
        </p>
      </section>
    </div>
  )
}

export default SummaryView
