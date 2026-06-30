import React from "react"
import {
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Legend,
  ReferenceLine,
  ReferenceArea,
} from "recharts"
import ChartFrame from "@components/features/independence/ChartFrame"
import Spinner from "@components/ui/Spinner"
import Alert from "@components/ui/Alert"
import { usePrivacyMode } from "@hooks/usePrivacyMode"
import { buildWealthJourneyChartData } from "@lib/independence/wealthJourneyChartData"
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
export default function WealthJourneyTab(): React.ReactElement | null {
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
    return null
  }

  // Stacked-area data — bottom-up: Liquid (spendable) + Housing + CPF
  // Annuity. Top of stack = totalWealth. Locked layers signal the share
  // of net worth that isn't drawdownable in retirement. CPF MA is
  // deliberately excluded — it's an earmarked healthcare reserve
  // (MediShield / CareShield premiums + approved medical), not part of
  // wealth available for spending. The MA balance is surfaced
  // separately on the Assets-by-Category panel ("Medical only" tag).
  // buildWealthJourneyChartData also nets cpfNonLiquidValue out of
  // housingValue so users with no real estate don't see a phantom
  // Housing legend entry from the upstream svc-retire MA bleed.
  // Prepend accumulation rows so the chart spans current-age → life-expectancy,
  // matching the single-plan My Path tab. Backend emits accumulationProjections
  // when the user hasn't yet reached retirement age; empty when already retired.
  const allRows = [
    ...(projection.accumulationProjections ?? []),
    ...projection.yearlyProjections,
  ]
  const { chartData, hasHousingLayer, hasAnnuitizedLayer } =
    buildWealthJourneyChartData(allRows)

  // First year where housingValue drops to 0 after being > 0 = property sold.
  // CompositeYearlyProjection lacks propertyLiquidated, so we detect from the
  // value transition. When this fires the user's liquid balance was below the
  // threshold — a safety-net event, not a FIRE success milestone.
  let propertyLiquidationAge: number | null = null
  for (let i = 1; i < chartData.length; i++) {
    if (chartData[i - 1].housingValue > 0 && chartData[i].housingValue === 0) {
      propertyLiquidationAge = chartData[i].age
      break
    }
  }

  if (chartData.length === 0) {
    return null
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
      <ChartFrame heightClass="h-56 sm:h-72">
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
              // Include liquidation age so label always has an axis anchor
              if (
                propertyLiquidationAge != null &&
                !ticks.includes(propertyLiquidationAge)
              ) {
                ticks.push(propertyLiquidationAge)
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
              if (name === "liquidValue")
                return [formatted, "Liquid (spendable)"]
              if (name === "housingValue")
                return [formatted, "Housing (locked)"]
              if (name === "annuitizedValue")
                return [formatted, "CPF LIFE principal (locked)"]
              return [formatted, String(name)]
            }}
            labelFormatter={(label) => {
              const point = chartData.find((d) => d.age === label)
              return point ? `Age ${label} — ${point.planName}` : `Age ${label}`
            }}
          />
          <Legend
            verticalAlign="top"
            height={36}
            formatter={(value: string) =>
              value === "liquidValue"
                ? "Liquid (spendable)"
                : value === "housingValue"
                  ? "Housing (locked)"
                  : value === "annuitizedValue"
                    ? "CPF LIFE principal (locked)"
                    : value
            }
          />

          {/* Zero line */}
          <ReferenceLine y={0} stroke="#ef4444" strokeWidth={2} />

          {/* Property liquidation warning — amber dashed line.
                Selling property is a safety-net fallback (liquid depleted),
                not a FIRE success event. isFront ensures the label renders
                above area layers regardless of which age the sale occurs. */}
          {hasHousingLayer && propertyLiquidationAge != null && (
            <ReferenceLine
              x={propertyLiquidationAge}
              stroke="#d97706"
              strokeDasharray="4 4"
              strokeWidth={2}
              label={{
                value: `⚠ Property sold (${propertyLiquidationAge})`,
                position: "insideTopRight",
                fill: "#d97706",
                fontSize: 11,
                fontWeight: 600,
              }}
            />
          )}

          {/* Phase background shading */}
          {phaseBoundaries.map((pb) => (
            <ReferenceArea
              key={`phase-bg-${pb.planId}-${pb.fromAge}`}
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
                key={`phase-line-${pb.planId}-${pb.fromAge}`}
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

          {/* Stacked-area wealth journey: Liquid (bottom) + Housing
                + CPF LIFE principal. Top of stack = drawdownable + locked
                principal at each age. CPF MA is intentionally excluded —
                it's an earmarked healthcare reserve (MediShield /
                CareShield premiums + approved medical), not wealth
                available for retirement spending. Surface MA via the
                Assets-by-Category panel instead.
                Liquidity gradient palette — bright blue Liquid pops,
                muted orange/grey locked layers recede. Green deliberately
                avoided on locked layers; it would imply "wealth growing"
                and undo the spendable-vs-locked story. */}
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
        </ComposedChart>
      </ChartFrame>

      {/* Phase legend */}
      <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-gray-100">
        {phaseBoundaries.map((pb) => (
          <div
            key={`${pb.planId}-${pb.fromAge}`}
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
