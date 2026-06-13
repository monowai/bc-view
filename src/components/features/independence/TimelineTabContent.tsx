import React, { useState, useMemo } from "react"
import {
  ComposedChart,
  Line,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ReferenceLine,
  ReferenceArea,
  Legend,
} from "recharts"
import ChartFrame from "@components/features/independence/ChartFrame"
import CollapsibleSection from "@components/ui/CollapsibleSection"
import { RetirementProjection } from "types/independence"
import { HIDDEN_VALUE } from "@lib/independence/planHelpers"
import { netHousingValue } from "@lib/independence/wealthJourneyChartData"
import { IncomeBreakdownTable } from "@components/features/independence"
import Spinner from "@components/ui/Spinner"

interface TimelineTabContentProps {
  projection: RetirementProjection | null
  baselineProjection: RetirementProjection | null
  retirementAge: number
  lifeExpectancy: number
  hideValues: boolean
  isCalculating: boolean
  /** Currency code passed for any future display use; currently unused. */
  effectiveCurrency?: string
}

export default function TimelineTabContent({
  projection,
  baselineProjection,
  retirementAge,
  lifeExpectancy,
  hideValues,
  isCalculating,
}: TimelineTabContentProps): React.ReactElement {
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

  // Detect life events from projection data (years with non-zero lifeEventAmount)
  const lifeEventAges = useMemo(() => {
    if (!projection) return []
    const events: {
      age: number
      amount: number
      type: "income" | "expense"
    }[] = []
    for (const y of projection.accumulationProjections || []) {
      // lifeEventAmount may be present in the JSON but not typed on YearlyAccumulation
      const amt = (y as unknown as { lifeEventAmount?: number }).lifeEventAmount
      if (amt && amt !== 0 && y.age != null) {
        events.push({
          age: y.age,
          amount: amt,
          type: amt > 0 ? "income" : "expense",
        })
      }
    }
    for (const y of projection.yearlyProjections) {
      if (y.lifeEventAmount && y.lifeEventAmount !== 0 && y.age != null) {
        events.push({
          age: y.age!,
          amount: y.lifeEventAmount,
          type: y.lifeEventAmount > 0 ? "income" : "expense",
        })
      }
    }
    return events
  }, [projection])

  // Age at which illiquid assets (property) were liquidated
  const liquidationAge = useMemo(() => {
    if (!projection) return null
    const year = projection.yearlyProjections.find((y) => y.propertyLiquidated)
    return year?.age ?? null
  }, [projection])

  // Active scenario = backend captured a baseline overlay alongside the
  // adjusted projection. Used to gate the "compared to baseline" UI.
  const hasActiveWhatIf = baselineProjection !== null

  // Combine accumulation and drawdown for chart. Sub-bucket fields drive
  // the stacked-area visualisation (Liquid + Housing + CPF LIFE principal).
  // Locked layers grow even after liquid depletes, so the chart shows
  // each separately instead of lumping into a single Total Wealth line.
  // CPF MA is excluded — see comment on hasAnnuitizedLayer.
  const fullJourneyData = useMemo(() => {
    if (!projection) return []

    const accumulationData = (projection.accumulationProjections || []).map(
      (year) => ({
        age: year.age,
        endingBalance: year.endingBalance,
        accumulationBalance: year.endingBalance,
        retirementBalance: null as number | null,
        totalWealth: year.totalWealth,
        liquidValue: year.endingBalance,
        housingValue: netHousingValue(year),
        annuitizedValue: year.annuitizedValue ?? 0,
        contribution: year.contribution,
        investmentGrowth: year.investmentGrowth,
        phase: "accumulation" as const,
      }),
    )

    const retirementData = projection.yearlyProjections.map((year, index) => ({
      age: year.age,
      endingBalance: year.endingBalance,
      accumulationBalance:
        index === 0 ? year.endingBalance : (null as number | null),
      retirementBalance: year.endingBalance,
      totalWealth: year.totalWealth,
      liquidValue: year.endingBalance,
      housingValue: netHousingValue(year),
      annuitizedValue: year.annuitizedValue ?? 0,
      withdrawals: year.withdrawals,
      investment: year.investment,
      unfundedExpense: year.unfundedExpense ?? 0,
      phase: "retirement" as const,
    }))

    return [...accumulationData, ...retirementData]
  }, [projection])

  // Hide stacked layers (and their legend entries) when the user has none
  // of that asset class. Mary has no housing → drop the Housing band.
  // Mike has no CPF → drop the CPF LIFE band. CPF MA is never stacked here
  // — it's an earmarked healthcare reserve, not drawdownable wealth — so
  // the layer doesn't exist regardless of who's viewing.
  const hasHousingLayer = useMemo(
    () => fullJourneyData.some((p) => (p.housingValue ?? 0) > 0),
    [fullJourneyData],
  )
  const hasAnnuitizedLayer = useMemo(
    () => fullJourneyData.some((p) => (p.annuitizedValue ?? 0) > 0),
    [fullJourneyData],
  )

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

  if (!projection || projection.yearlyProjections.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="text-center py-12 text-gray-500">
          {isCalculating ? (
            <Spinner label={"Calculating projection..."} size="lg" />
          ) : (
            <>
              <i className="fas fa-chart-line text-4xl mb-3 text-gray-300"></i>
              <p>{"No projection data available"}</p>
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
        <ChartFrame heightClass="h-56 sm:h-72">
          <ComposedChart
            data={
              (chartDataWithBaseline.length > 0
                ? chartDataWithBaseline
                : projection.yearlyProjections) as Record<string, unknown>[]
            }
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
                if (retirementAge && !ticks.includes(retirementAge)) {
                  ticks.push(retirementAge)
                }
                if (fiAchievementAge && !ticks.includes(fiAchievementAge)) {
                  ticks.push(fiAchievementAge)
                }
                return ticks.sort((a, b) => a - b)
              })()}
            />
            <YAxis
              tickFormatter={(value) =>
                hideValues ? "****" : `$${(value / 1000).toFixed(0)}k`
              }
              tick={{ fontSize: 12 }}
            />
            <ChartTooltip
              formatter={(value, name) => {
                const formatted = hideValues
                  ? HIDDEN_VALUE
                  : `$${Number(value || 0).toLocaleString()}`
                if (name === "liquidValue")
                  return [formatted, "Liquid (spendable)"]
                if (name === "housingValue")
                  return [formatted, "Housing (locked)"]
                if (name === "annuitizedValue")
                  return [formatted, "CPF LIFE principal (locked)"]
                if (name === "fireBalance") return [formatted, "FIRE Path"]
                if (name === "baselineBalance") return [formatted, "Baseline"]
                return [formatted, name]
              }}
              labelFormatter={(label) => `Age ${label}`}
            />
            <Legend
              verticalAlign="top"
              height={36}
              formatter={(value) =>
                value === "liquidValue"
                  ? "Liquid (spendable)"
                  : value === "housingValue"
                    ? "Housing (locked)"
                    : value === "annuitizedValue"
                      ? "CPF LIFE principal (locked)"
                      : value === "fireBalance"
                        ? "FIRE Path"
                        : value === "baselineBalance"
                          ? "Baseline"
                          : value
              }
            />
            <ReferenceLine y={0} stroke="#ef4444" strokeWidth={2} />
            {/* Independence years shaded area - show in traditional view */}
            {timelineViewMode === "traditional" && retirementAge && (
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
            {timelineViewMode === "traditional" && retirementAge && (
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
            {/* Life event markers */}
            {lifeEventAges.map((event) => (
              <ReferenceLine
                key={`life-event-${event.age}`}
                x={event.age}
                stroke={event.type === "expense" ? "#ef4444" : "#22c55e"}
                strokeDasharray="3 3"
                strokeWidth={1.5}
                label={{
                  value: `${event.type === "expense" ? "-" : "+"}$${Math.abs(Math.round(event.amount / 1000))}k`,
                  position: "insideTopRight",
                  fill: event.type === "expense" ? "#ef4444" : "#22c55e",
                  fontSize: 10,
                }}
              />
            ))}
            {/* Property liquidation marker */}
            {liquidationAge && (
              <ReferenceLine
                x={liquidationAge}
                stroke="#7c3aed"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: `Property sold (${liquidationAge})`,
                  position: "top",
                  fill: "#7c3aed",
                  fontSize: 11,
                  fontWeight: 500,
                }}
              />
            )}
            {/* Stacked wealth journey — bottom-up: Liquid (spendable),
                  Housing, CPF LIFE principal. Top of the stack equals
                  drawdownable + locked principal at each age. CPF MA is
                  intentionally excluded — it's an earmarked healthcare
                  reserve (MediShield / CareShield premiums + approved
                  medical), not wealth available for retirement spending.
                  Surface MA via the Assets-by-Category panel instead.
                  Liquidity gradient palette: Liquid pops in bright blue;
                  locked layers drop into muted oranges/greys so the user
                  reads brightness as 'spendable' at a glance. Green is
                  deliberately avoided on locked layers — it carries a
                  'wealth growing' connotation that undoes the message. */}
            {timelineViewMode === "traditional" && (
              <>
                <Area
                  type="monotone"
                  dataKey="liquidValue"
                  stackId="wealth"
                  stroke="#1d4ed8"
                  fill="#2563eb"
                  fillOpacity={0.7}
                  strokeWidth={2}
                  name="liquidValue"
                />
                {hasHousingLayer && (
                  <Area
                    type="monotone"
                    dataKey="housingValue"
                    stackId="wealth"
                    stroke="#c2410c"
                    fill="#f97316"
                    fillOpacity={0.3}
                    strokeWidth={1}
                    name="housingValue"
                  />
                )}
                {hasAnnuitizedLayer && (
                  <Area
                    type="monotone"
                    dataKey="annuitizedValue"
                    stackId="wealth"
                    stroke="#64748b"
                    fill="#94a3b8"
                    fillOpacity={0.3}
                    strokeWidth={1}
                    name="annuitizedValue"
                  />
                )}
              </>
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
        </ChartFrame>
      </CollapsibleSection>

      <CollapsibleSection
        title="Cash Flows"
        icon="fa-exchange-alt"
        iconColor="text-green-500"
        isOpen={openSections["cashFlows"]}
        onToggle={() => toggleSection("cashFlows")}
      >
        <ChartFrame heightClass="h-52 sm:h-64">
          <ComposedChart
            data={[
              // Accumulation rows: pre-retirement contributions + growth are
              // the positive ("Returns & Income") bar; there are no
              // withdrawals yet. Mirrors the Wealth Journey's axis so the
              // viewer can read all three charts on the same timeline.
              ...(projection.accumulationProjections ?? []).map((y) => ({
                age: y.age,
                year: y.year,
                investmentAndIncome:
                  y.contribution + y.investmentGrowth + (y.lumpSumPayout ?? 0),
                negWithdrawals: 0,
              })),
              ...projection.yearlyProjections.map((y) => ({
                ...y,
                // Life event expenses are already in withdrawals (backend includes them)
                // Life event income needs to be added to the positive bar
                investmentAndIncome:
                  y.investment + (y.incomeBreakdown?.lifeEventIncome ?? 0),
                negWithdrawals: -y.withdrawals,
              })),
            ]}
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
                hideValues ? "****" : `$${(value / 1000).toFixed(0)}k`
              }
              tick={{ fontSize: 12 }}
            />
            <ChartTooltip
              formatter={(value, name) => {
                if (hideValues) {
                  if (name === "negWithdrawals")
                    return [HIDDEN_VALUE, "Withdrawals"]
                  return [HIDDEN_VALUE, "Returns & Income"]
                }
                const absVal = Math.abs(Number(value || 0))
                if (name === "negWithdrawals") {
                  return [`-$${absVal.toLocaleString()}`, "Withdrawals"]
                }
                return [`+$${absVal.toLocaleString()}`, "Returns & Income"]
              }}
              labelFormatter={(label) => `Age ${label}`}
            />
            <Legend
              verticalAlign="top"
              height={36}
              formatter={(value) =>
                value === "negWithdrawals" ? "Withdrawals" : "Returns & Income"
              }
            />
            <ReferenceLine y={0} stroke="#9ca3af" />
            <Bar
              dataKey="investmentAndIncome"
              fill="#22c55e"
              name="investmentAndIncome"
            />
            <Bar
              dataKey="negWithdrawals"
              fill="#ef4444"
              name="negWithdrawals"
            />
          </ComposedChart>
        </ChartFrame>
      </CollapsibleSection>

      {/* ScenarioImpact card removed: its liquidation-threshold slider was
          part of the old What-If model. The ScenarioBar at the top of the
          page now owns scenario controls. Re-introduce as a read-only
          "what changed" comparison view if the need surfaces. */}

      <CollapsibleSection
        title="Income Breakdown"
        icon="fa-table"
        iconColor="text-indigo-500"
        isOpen={openSections["incomeBreakdown"]}
        onToggle={() => toggleSection("incomeBreakdown")}
      >
        <IncomeBreakdownTable
          projections={(() => {
            // Composite projections (multi-plan / pension plans) expose `expenses`
            // and `income` instead of the single-plan `inflationAdjustedExpenses`
            // and `withdrawals`. Normalize both shapes so the Expenses/Withdrawals
            // columns populate every year regardless of which projector produced
            // the rows.
            type LooseYear = Omit<
              (typeof projection.yearlyProjections)[number],
              "inflationAdjustedExpenses" | "withdrawals"
            > & {
              inflationAdjustedExpenses?: number
              withdrawals?: number
              expenses?: number
              income?: number
            }
            const yearly = projection.yearlyProjections as LooseYear[]

            // Accumulation rows carry no expense figure. Inflate the base annual
            // expense to each working year so the column reads as a growing series
            // rather than a dash. Inflation is read off the retirement expense
            // curve (the backend compounds it at a single rate).
            const baseAnnualExpenses = (projection.monthlyExpenses ?? 0) * 12
            const e0 =
              yearly[0]?.inflationAdjustedExpenses ?? yearly[0]?.expenses ?? 0
            const e1 =
              yearly[1]?.inflationAdjustedExpenses ?? yearly[1]?.expenses ?? 0
            const annualInflation = e0 > 0 && e1 > 0 ? e1 / e0 - 1 : 0
            const firstAccumAge =
              projection.accumulationProjections?.[0]?.age ?? 0

            return [
              ...(projection.accumulationProjections ?? []).map((y) => ({
                year: y.year,
                age: y.age,
                startingBalance: y.startingBalance,
                investment: y.contribution + y.investmentGrowth,
                withdrawals: 0,
                endingBalance: y.endingBalance,
                inflationAdjustedExpenses: Math.round(
                  baseAnnualExpenses *
                    Math.pow(1 + annualInflation, y.age - firstAccumAge),
                ),
                currency: y.currency,
                nonSpendableValue: y.nonSpendableValue,
                totalWealth: y.totalWealth,
                incomeBreakdown: {
                  investmentReturns:
                    y.contribution +
                    y.investmentGrowth +
                    (y.lumpSumPayout ?? 0),
                  pension: 0,
                  socialSecurity: 0,
                  otherIncome: 0,
                  rentalIncome: 0,
                  totalIncome:
                    y.contribution +
                    y.investmentGrowth +
                    (y.lumpSumPayout ?? 0),
                  lumpSumPayout: y.lumpSumPayout,
                },
              })),
              ...yearly.map((y) => {
                const expenses = y.inflationAdjustedExpenses ?? y.expenses ?? 0
                const totalIncome =
                  y.incomeBreakdown?.totalIncome ?? y.income ?? 0
                return {
                  ...y,
                  inflationAdjustedExpenses: expenses,
                  withdrawals:
                    y.withdrawals ?? Math.max(0, expenses - totalIncome),
                }
              }),
            ]
          })()}
          embedded
        />
      </CollapsibleSection>
    </div>
  )
}
