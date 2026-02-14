import React, { useState, useMemo } from "react"
import { useTranslation } from "next-i18next"
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Legend,
} from "recharts"
import CollapsibleSection from "@components/ui/CollapsibleSection"
import { RetirementProjection } from "types/independence"
import { HIDDEN_VALUE } from "@lib/independence/planHelpers"
import {
  WhatIfAdjustments,
  hasScenarioChanges,
  ScenarioImpact,
  IncomeBreakdownTable,
} from "@components/features/independence"
import Spinner from "@components/ui/Spinner"

interface TimelineTabContentProps {
  projection: RetirementProjection | null
  baselineProjection: RetirementProjection | null
  retirementAge: number
  lifeExpectancy: number
  combinedAdjustments: WhatIfAdjustments
  hideValues: boolean
  isCalculating: boolean
  effectiveCurrency: string
  onLiquidationThresholdChange: (value: number) => void
}

export default function TimelineTabContent({
  projection,
  baselineProjection,
  retirementAge,
  lifeExpectancy,
  combinedAdjustments,
  hideValues,
  isCalculating,
  effectiveCurrency,
  onLiquidationThresholdChange,
}: TimelineTabContentProps): React.ReactElement {
  const { t } = useTranslation("common")

  // Timeline view mode - "traditional" shows work-to-retire path, "fire" shows FIRE path
  const [timelineViewMode, setTimelineViewMode] = useState<
    "traditional" | "fire"
  >("traditional")

  // Track which collapsible sections are open
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})
  const toggleSection = (key: string): void =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))

  // FI achievement age from backend calculation
  const fiAchievementAge = projection?.fiAchievementAge ?? null

  // Determine if what-if changes are active
  const hasActiveWhatIf =
    hasScenarioChanges(combinedAdjustments) ||
    baselineProjection !== null

  // Combine accumulation and drawdown for chart
  const fullJourneyData = useMemo(() => {
    if (!projection) return []

    const accumulationData = (
      projection.accumulationProjections || []
    ).map((year) => ({
      age: year.age,
      endingBalance: year.endingBalance,
      accumulationBalance: year.endingBalance,
      retirementBalance: null as number | null,
      totalWealth: year.totalWealth,
      contribution: year.contribution,
      investmentGrowth: year.investmentGrowth,
      phase: "accumulation" as const,
    }))

    const retirementData = projection.yearlyProjections.map(
      (year, index) => ({
        age: year.age,
        endingBalance: year.endingBalance,
        accumulationBalance:
          index === 0 ? year.endingBalance : (null as number | null),
        retirementBalance: year.endingBalance,
        totalWealth: year.totalWealth,
        withdrawals: year.withdrawals,
        investment: year.investment,
        phase: "retirement" as const,
      }),
    )

    return [...accumulationData, ...retirementData]
  }, [projection])

  // Merge FIRE path projections into chart data
  const chartDataWithFirePath = useMemo(() => {
    const firePathProjections = projection?.firePathProjections
    if (!firePathProjections || firePathProjections.length === 0)
      return fullJourneyData

    const fireBalanceMap = new Map(
      firePathProjections.map((d) => [d.age, d.endingBalance]),
    )

    return fullJourneyData.map((point) => ({
      ...point,
      fireBalance:
        point.age != null ? (fireBalanceMap.get(point.age) ?? null) : null,
    }))
  }, [fullJourneyData, projection?.firePathProjections])

  // Merge baseline projection data for comparison line
  const chartDataWithBaseline = useMemo(() => {
    if (!baselineProjection || !hasActiveWhatIf) return chartDataWithFirePath

    const map = new Map<number, number>()
    for (const y of baselineProjection.accumulationProjections || []) {
      if (y.age != null) map.set(y.age, y.endingBalance)
    }
    for (const y of baselineProjection.yearlyProjections) {
      if (y.age != null) map.set(y.age, y.endingBalance)
    }

    return chartDataWithFirePath.map((point) => ({
      ...point,
      baselineBalance: point.age != null ? (map.get(point.age) ?? null) : null,
    }))
  }, [chartDataWithFirePath, baselineProjection, hasActiveWhatIf])

  if (
    !projection ||
    projection.yearlyProjections.length === 0
  ) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="text-center py-12 text-gray-500">
          {isCalculating ? (
            <Spinner
              label={t("retire.assets.calculating")}
              size="lg"
            />
          ) : (
            <>
              <i className="fas fa-chart-line text-4xl mb-3 text-gray-300"></i>
              <p>{t("retire.timeline.noData")}</p>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <CollapsibleSection
        title="Wealth Journey"
        icon="fa-chart-line"
        iconColor="text-blue-500"
        isOpen={openSections["wealthJourney"]}
        onToggle={() => toggleSection("wealthJourney")}
        headerRight={
          fiAchievementAge ? (
            <div className="flex bg-gray-100 rounded-lg p-1 shrink-0">
              <button
                onClick={() => setTimelineViewMode("traditional")}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  timelineViewMode === "traditional"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Traditional
              </button>
              <button
                onClick={() => setTimelineViewMode("fire")}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  timelineViewMode === "fire"
                    ? "bg-white text-green-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                FIRE
              </button>
            </div>
          ) : undefined
        }
      >
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={
                chartDataWithBaseline.length > 0
                  ? chartDataWithBaseline
                  : projection.yearlyProjections
              }
              margin={{ top: 10, right: 30, left: 20, bottom: 20 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e5e7eb"
              />
              <XAxis
                dataKey="age"
                label={{
                  value: "Age",
                  position: "insideBottom",
                  offset: -10,
                }}
                tick={{ fontSize: 12 }}
                domain={[
                  (dataMin: number) =>
                    Math.min(
                      dataMin,
                      retirementAge ? retirementAge - 3 : dataMin,
                    ),
                  "dataMax",
                ]}
                allowDataOverflow={true}
                ticks={(() => {
                  const ages = fullJourneyData
                    .map((d) => d.age)
                    .filter((a): a is number => a !== undefined)
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
                  if (
                    retirementAge &&
                    !ticks.includes(retirementAge)
                  ) {
                    ticks.push(retirementAge)
                  }
                  if (
                    fiAchievementAge &&
                    !ticks.includes(fiAchievementAge)
                  ) {
                    ticks.push(fiAchievementAge)
                  }
                  return ticks.sort((a, b) => a - b)
                })()}
              />
              <YAxis
                tickFormatter={(value) =>
                  hideValues
                    ? "****"
                    : `$${(value / 1000).toFixed(0)}k`
                }
                tick={{ fontSize: 12 }}
              />
              <ChartTooltip
                formatter={(value, name) => {
                  const formatted = hideValues
                    ? HIDDEN_VALUE
                    : `$${Number(value || 0).toLocaleString()}`
                  if (name === "totalWealth")
                    return [formatted, "Total Wealth"]
                  if (name === "accumulationBalance")
                    return [formatted, "Working Years"]
                  if (name === "retirementBalance")
                    return [formatted, "Independence Years"]
                  if (name === "fireBalance")
                    return [formatted, "FIRE Path"]
                  if (name === "baselineBalance")
                    return [formatted, "Baseline"]
                  return [formatted, name]
                }}
                labelFormatter={(label) => `Age ${label}`}
              />
              <Legend
                verticalAlign="top"
                height={36}
                formatter={(value) =>
                  value === "totalWealth"
                    ? "Total Wealth"
                    : value === "accumulationBalance"
                      ? "Working Years"
                      : value === "retirementBalance"
                        ? "Independence Years"
                        : value === "fireBalance"
                          ? "FIRE Path"
                          : value === "baselineBalance"
                            ? "Baseline"
                            : value
                }
              />
              <ReferenceLine
                y={0}
                stroke="#ef4444"
                strokeWidth={2}
              />
              {/* Independence years shaded area - show in traditional view */}
              {timelineViewMode === "traditional" &&
                retirementAge && (
                  <ReferenceArea
                    x1={retirementAge}
                    x2={lifeExpectancy}
                    fill="#f97316"
                    fillOpacity={0.15}
                    stroke="#f97316"
                    strokeOpacity={0.3}
                  />
                )}
              {/* Retirement age transition line - show in traditional view */}
              {timelineViewMode === "traditional" &&
                retirementAge && (
                  <ReferenceLine
                    x={retirementAge}
                    stroke="#f97316"
                    strokeDasharray="5 5"
                    strokeWidth={2}
                    label={{
                      value: `Independence (${retirementAge})`,
                      position: "top",
                      fill: "#f97316",
                      fontSize: 11,
                    }}
                  />
                )}
              {/* FI achievement age line - show in FIRE view */}
              {timelineViewMode === "fire" && fiAchievementAge && (
                <ReferenceLine
                  x={fiAchievementAge}
                  stroke="#22c55e"
                  strokeDasharray="3 3"
                  strokeWidth={2}
                  label={{
                    value: "FI",
                    position: "top",
                    fill: "#22c55e",
                    fontSize: 11,
                  }}
                />
              )}
              {/* Total Wealth line - show in traditional view when non-spendable assets exist */}
              {timelineViewMode === "traditional" &&
                projection.nonSpendableAtRetirement > 0 && (
                  <Line
                    type="monotone"
                    dataKey="totalWealth"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={{ r: 2, fill: "#22c55e" }}
                    name="totalWealth"
                  />
                )}
              {/* Traditional path - Working years (blue) */}
              {timelineViewMode === "traditional" && (
                <Line
                  type="monotone"
                  dataKey="accumulationBalance"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={{ r: 3, fill: "#3b82f6" }}
                  name="accumulationBalance"
                  connectNulls={false}
                />
              )}
              {/* Traditional path - Independence years (purple) */}
              {timelineViewMode === "traditional" && (
                <Line
                  type="monotone"
                  dataKey="retirementBalance"
                  stroke="#f97316"
                  strokeWidth={3}
                  dot={{ r: 3, fill: "#f97316" }}
                  name="retirementBalance"
                  connectNulls={false}
                />
              )}
              {/* FIRE path */}
              {timelineViewMode === "fire" &&
                fiAchievementAge &&
                projection?.firePathProjections && (
                  <Line
                    type="monotone"
                    dataKey="fireBalance"
                    stroke="#22c55e"
                    strokeWidth={3}
                    dot={{ r: 3, fill: "#22c55e" }}
                    name="fireBalance"
                  />
                )}
              {/* Baseline comparison line */}
              {baselineProjection && hasActiveWhatIf && (
                <Line
                  type="monotone"
                  dataKey="baselineBalance"
                  stroke="#9ca3af"
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                  dot={false}
                  name="baselineBalance"
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Cash Flows"
        icon="fa-exchange-alt"
        iconColor="text-green-500"
        isOpen={openSections["cashFlows"]}
        onToggle={() => toggleSection("cashFlows")}
      >
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={projection.yearlyProjections.map(
                (y) => ({
                  ...y,
                  negWithdrawals: -y.withdrawals,
                }),
              )}
              margin={{ top: 10, right: 30, left: 20, bottom: 20 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e5e7eb"
              />
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
                    ? "****"
                    : `$${(value / 1000).toFixed(0)}k`
                }
                tick={{ fontSize: 12 }}
              />
              <ChartTooltip
                formatter={(value, name) => {
                  if (hideValues) {
                    if (name === "negWithdrawals") {
                      return [HIDDEN_VALUE, "Withdrawals"]
                    }
                    return [HIDDEN_VALUE, "Investment Returns"]
                  }
                  const absVal = Math.abs(Number(value || 0))
                  if (name === "negWithdrawals") {
                    return [
                      `-$${absVal.toLocaleString()}`,
                      "Withdrawals",
                    ]
                  }
                  return [
                    `+$${absVal.toLocaleString()}`,
                    "Investment Returns",
                  ]
                }}
                labelFormatter={(label) => `Age ${label}`}
              />
              <Legend
                verticalAlign="top"
                height={36}
                formatter={(value) =>
                  value === "negWithdrawals"
                    ? "Withdrawals"
                    : "Investment Returns"
                }
              />
              <ReferenceLine y={0} stroke="#9ca3af" />
              <Bar
                dataKey="investment"
                fill="#22c55e"
                name="Investment Returns"
              />
              <Bar
                dataKey="negWithdrawals"
                fill="#ef4444"
                name="negWithdrawals"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Scenario Impact"
        icon="fa-calculator"
        iconColor="text-independence-500"
        isOpen={openSections["scenarioImpact"]}
        onToggle={() => toggleSection("scenarioImpact")}
      >
        <ScenarioImpact
          projection={projection}
          lifeExpectancy={lifeExpectancy}
          currency={effectiveCurrency}
          whatIfAdjustments={combinedAdjustments}
          onLiquidationThresholdChange={onLiquidationThresholdChange}
        />
      </CollapsibleSection>

      <CollapsibleSection
        title="Income Breakdown"
        icon="fa-table"
        iconColor="text-indigo-500"
        isOpen={openSections["incomeBreakdown"]}
        onToggle={() => toggleSection("incomeBreakdown")}
      >
        <IncomeBreakdownTable
          projections={projection.yearlyProjections}
          embedded
        />
      </CollapsibleSection>
    </div>
  )
}
