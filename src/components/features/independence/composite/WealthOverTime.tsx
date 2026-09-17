import React, { useMemo, useState } from "react"
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ReferenceLine,
  ReferenceArea,
} from "recharts"
import ChartFrame from "@components/features/independence/ChartFrame"
import JourneyRibbon from "@components/features/independence/ribbons/JourneyRibbon"
import Alert from "@components/ui/Alert"
import Spinner from "@components/ui/Spinner"
import { usePrivacyMode } from "@hooks/usePrivacyMode"
import { ageAxisDomain, ageAxisTicks } from "@lib/independence/ageAxis"
import { compositeAnswers } from "@lib/independence/compositeAnswers"
import {
  buildWealthJourneyChartData,
  WealthJourneyChartRow,
} from "@lib/independence/wealthJourneyChartData"
import {
  deriveJourneyRibbon,
  fromCompositeRows,
} from "@lib/independence/journeyRibbon"
import { formatCompact, formatCompactBare } from "@lib/formatters"
import { useCompositeProjectionContext } from "./CompositeProjectionContext"

const HIDDEN_VALUE = "****"
const ITERATION_OPTIONS = [500, 1000, 2000, 5000]

/** Phase band tints. Backgrounds only — never the meaning-bearing colour. */
const PHASE_TINTS = [
  "#3b82f6",
  "#f97316",
  "#22c55e",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
]

type Lens = "lasts" | "madeOf"

/**
 * One row of whichever lens is showing.
 *
 * The two lenses feed the same chart different shapes: "lasts" carries the
 * liquid balance plus the Monte Carlo bands once they exist, "made of" carries
 * the stacked wealth components. Recharts reads by `dataKey` and draws nothing
 * for a key a row lacks, so one chart over a union is correct — but typing
 * `data` off whichever member TypeScript saw first is not, and it is what left
 * `yarn typecheck` red while CI (tests + build only) stayed green.
 */
type LensRow = { age: number; endingBalance: number } & Partial<
  Omit<WealthJourneyChartRow, "age" | "endingBalance">
> &
  Partial<{
    p10Base: number
    outerWidth: number
    p25Base: number
    innerWidth: number
    p50: number
  }>

const LENSES: { id: Lens; label: string; hint: string }[] = [
  {
    id: "lasts",
    label: "Will it last?",
    hint: "Money you can spend, against the target you need to retire on.",
  },
  {
    id: "madeOf",
    label: "What it's made of",
    hint: "The same wealth, split into what you can spend and what's tied up.",
  },
]

/**
 * The one chart on this page.
 *
 * It replaces three tabs that all drew wealth against age — an FI trajectory,
 * a stacked wealth journey, and a year-by-year table — which between them made
 * the same data look like three unrelated answers. They are not merged into a
 * single drawing, because they genuinely answer different questions and
 * stacking a spendable/locked breakdown under an FI target line would destroy
 * the spendable-vs-locked story. Instead there is one chart slot with two
 * lenses over a shared age axis, and the table below it as detail on demand.
 *
 * The stress test lives here too, as a control on the thing it modifies,
 * rather than as a separate tab running the same simulation with its own
 * duplicate iteration picker.
 */
export default function WealthOverTime(): React.ReactElement | null {
  const {
    projection,
    plans,
    phases,
    displayCurrency,
    currentAge,
    isLoading,
    mc,
  } = useCompositeProjectionContext()
  const { hideValues } = usePrivacyMode()
  const [lens, setLens] = useState<Lens>("lasts")
  const [iterations, setIterations] = useState(1000)
  const [neverSellIlliquid, setNeverSellIlliquid] = useState(false)

  const answers = compositeAnswers(projection, currentAge)

  // ——— "Will it last?" rows: liquid balance, plus MC bands once run ———
  const trajectory = useMemo<LensRow[]>(() => {
    if (!projection?.yearlyProjections) return []
    const bandByYear = new Map(
      (mc.result?.yearlyBands ?? []).map((b) => [b.year, b]),
    )
    return projection.yearlyProjections.map((row) => {
      const band = bandByYear.get(row.year)
      return {
        age: row.age,
        endingBalance: row.endingBalance,
        ...(band
          ? {
              p10Base: band.p10,
              outerWidth: Math.max(0, band.p90 - band.p10),
              p25Base: band.p25,
              innerWidth: Math.max(0, band.p75 - band.p25),
              p50: band.p50,
            }
          : {}),
      }
    })
  }, [projection, mc.result])

  // ——— "What it's made of" rows: accumulation + drawdown, stacked ———
  const allRows = useMemo(
    () => [
      ...(projection?.accumulationProjections ?? []),
      ...(projection?.yearlyProjections ?? []),
    ],
    [projection],
  )
  const madeOf = useMemo(() => buildWealthJourneyChartData(allRows), [allRows])

  // First year housing drops to zero after being positive = property sold to
  // cover spending. A safety-net event, not a milestone — it gets a warning
  // marker, never a celebratory one.
  const propertyLiquidationAge = useMemo(() => {
    const rows = madeOf.chartData
    for (let i = 1; i < rows.length; i++) {
      if (rows[i - 1].housingValue > 0 && rows[i].housingValue === 0) {
        return rows[i].age
      }
    }
    return null
  }, [madeOf.chartData])

  const phaseBands = useMemo(
    () =>
      (projection?.phases ?? []).map((phase, idx) => ({
        ...phase,
        tint: PHASE_TINTS[idx % PHASE_TINTS.length],
      })),
    [projection],
  )

  const rows: LensRow[] = lens === "lasts" ? trajectory : madeOf.chartData
  const fiNumber = answers?.fiNumber ?? 0

  // Plain derivation, not useMemo: `rows` and `answers` are themselves
  // per-render derivations, so a manual memo here cannot be preserved and
  // costs the whole component its React Compiler optimization.
  const ageAxis = ((): { domain: [number, number]; ticks: number[] } => {
    // Plan rows don't always carry a lifeExpectancy — svc-retire's list
    // response omits it — and Math.max over a missing field yields NaN, which
    // used to collapse the axis to a single tick. Undefined lets ageAxisDomain
    // fall back to the projected age range, which ends at the horizon anyway.
    const horizons = plans
      .map((p) => p.lifeExpectancy)
      .filter((v): v is number => Number.isFinite(v))
    const lifeExpectancy = horizons.length ? Math.max(...horizons) : undefined
    const [minAge, maxAge] = ageAxisDomain(
      currentAge,
      lifeExpectancy,
      rows.map((r) => r.age),
    )
    return {
      domain: [minAge, maxAge],
      ticks: ageAxisTicks(
        minAge,
        maxAge,
        answers?.fiCrossingAge != null ? [answers.fiCrossingAge] : [],
      ),
    }
  })()

  const yMax = useMemo(() => {
    if (lens === "madeOf") return undefined
    if (!trajectory.length) return fiNumber * 1.2 || 1
    const maxBal = Math.max(
      ...trajectory.map((r) =>
        Math.max(
          r.endingBalance,
          (r.p10Base ?? 0) + (r.outerWidth ?? 0),
          r.p50 ?? 0,
        ),
      ),
    )
    return Math.max(maxBal, fiNumber) * 1.1
  }, [lens, trajectory, fiNumber])

  if (isLoading && !projection) {
    return (
      <div className="flex justify-center py-12">
        <Spinner label="Charting your wealth…" size="lg" />
      </div>
    )
  }
  // Projection failures are reported once, by the page.
  if (!projection || rows.length === 0) return null

  const hasBands = Boolean(mc.result)
  const activeLens = LENSES.find((l) => l.id === lens)!

  const runStress = (): void => {
    // Results land as bands on the "Will it last?" lens, so show that lens —
    // otherwise the button appears to do nothing.
    setLens("lasts")
    void mc.run({
      iterations,
      phases,
      displayCurrency,
      ...(neverSellIlliquid ? { neverSellIlliquid: true } : {}),
    })
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Your wealth over time
          </h2>
          <p className="mt-0.5 max-w-prose text-sm text-gray-600 dark:text-gray-400">
            {activeLens.hint}
          </p>
        </div>

        {/* Two views of one chart, not two tabs. */}
        <div
          role="group"
          aria-label="Chart view"
          className="inline-flex shrink-0 rounded-lg border border-gray-200 p-0.5 dark:border-gray-700"
        >
          {LENSES.map((l) => (
            <button
              key={l.id}
              type="button"
              aria-pressed={lens === l.id}
              onClick={() => setLens(l.id)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 motion-reduce:transition-none ${
                lens === l.id
                  ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <ChartFrame heightClass="h-64 sm:h-80">
          <ComposedChart
            data={rows}
            margin={{ top: 8, right: 16, bottom: 20, left: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#f1f5f9"
              vertical={false}
            />
            <XAxis
              dataKey="age"
              type="number"
              scale="linear"
              domain={ageAxis.domain}
              ticks={ageAxis.ticks}
              allowDataOverflow
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={false}
              label={{
                value: "Age",
                position: "insideBottom",
                offset: -10,
                fontSize: 11,
                fill: "#94a3b8",
              }}
            />
            <YAxis
              tickFormatter={hideValues ? () => "***" : formatCompactBare}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={false}
              width={54}
              {...(yMax != null ? { domain: [0, yMax] } : {})}
            />
            <ChartTooltip
              formatter={(value, name) => {
                const formatted = hideValues
                  ? HIDDEN_VALUE
                  : formatCompact(Number(value) || 0, displayCurrency)
                // The stacked lens keys carry storage names; the reader needs
                // the spendable-vs-locked distinction spelled out, since that
                // is the entire point of looking at this lens.
                const labels: Record<string, string> = {
                  liquidValue: "You can spend this",
                  housingValue: "Tied up in property",
                  annuitizedValue: "Locked in CPF LIFE",
                }
                const key = String(name ?? "")
                return [formatted, labels[key] ?? key]
              }}
              labelFormatter={(age) => {
                const point = madeOf.chartData.find((d) => d.age === age)
                return point?.planName
                  ? `Age ${age} — ${point.planName}`
                  : `Age ${age}`
              }}
              contentStyle={{
                fontSize: 12,
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                boxShadow: "0 4px 6px -1px rgba(0,0,0,.08)",
                padding: "6px 10px",
              }}
            />

            {/* Phase bands sit under both lenses — the shape of the plan is
                context for either question. */}
            {phaseBands.map((pb) => (
              <ReferenceArea
                key={`band-${pb.planId}-${pb.fromAge}`}
                x1={pb.fromAge}
                x2={pb.toAge}
                fill={pb.tint}
                fillOpacity={0.06}
                strokeOpacity={0}
              />
            ))}

            {lens === "lasts" && (
              <>
                {hasBands && (
                  <>
                    <Area
                      type="monotone"
                      dataKey="p10Base"
                      fill="transparent"
                      stroke="none"
                      stackId="outer"
                      isAnimationActive={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="outerWidth"
                      fill="rgba(34,197,94,0.09)"
                      stroke="none"
                      stackId="outer"
                      isAnimationActive={false}
                      name="Range of outcomes"
                    />
                    <Area
                      type="monotone"
                      dataKey="p25Base"
                      fill="transparent"
                      stroke="none"
                      stackId="inner"
                      isAnimationActive={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="innerWidth"
                      fill="rgba(34,197,94,0.15)"
                      stroke="none"
                      stackId="inner"
                      isAnimationActive={false}
                      name="Most likely range"
                    />
                    <Line
                      type="monotone"
                      dataKey="p50"
                      stroke="rgba(34,197,94,0.55)"
                      strokeWidth={1.5}
                      strokeDasharray="5 4"
                      dot={false}
                      isAnimationActive={false}
                      name="Middle outcome"
                    />
                  </>
                )}

                {fiNumber > 0 && (
                  <ReferenceLine
                    y={fiNumber}
                    stroke="#f97316"
                    strokeDasharray="6 4"
                    strokeWidth={1.5}
                    label={{
                      value: hideValues
                        ? "Target"
                        : `Target ${formatCompact(fiNumber, displayCurrency)}`,
                      position: "insideTopRight",
                      fontSize: 11,
                      fill: "#c2410c",
                      fontWeight: 600,
                    }}
                  />
                )}

                {answers?.fiCrossingAge != null && (
                  <ReferenceLine
                    x={answers.fiCrossingAge}
                    stroke="#94a3b8"
                    strokeDasharray="4 3"
                    strokeWidth={1}
                    label={{
                      value: `Age ${answers.fiCrossingAge}`,
                      position: "insideTopLeft",
                      fontSize: 11,
                      fill: "#64748b",
                      fontWeight: 500,
                    }}
                  />
                )}

                <Line
                  type="monotone"
                  dataKey="endingBalance"
                  stroke="#1e293b"
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive={false}
                  name="Money you can spend"
                  activeDot={{
                    r: 4,
                    fill: "#1e293b",
                    stroke: "white",
                    strokeWidth: 2,
                  }}
                />
              </>
            )}

            {lens === "madeOf" && (
              <>
                <ReferenceLine y={0} stroke="#ef4444" strokeWidth={2} />
                {madeOf.hasHousingLayer && propertyLiquidationAge != null && (
                  <ReferenceLine
                    x={propertyLiquidationAge}
                    stroke="#d97706"
                    strokeDasharray="4 4"
                    strokeWidth={2}
                    label={{
                      value: `Property sold (${propertyLiquidationAge})`,
                      position: "insideTopRight",
                      fill: "#b45309",
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="liquidValue"
                  stackId="wealth"
                  stroke="#1d4ed8"
                  fill="#2563eb"
                  fillOpacity={0.7}
                  strokeWidth={2}
                  isAnimationActive={false}
                  name="liquidValue"
                />
                {madeOf.hasHousingLayer && (
                  <Area
                    type="monotone"
                    dataKey="housingValue"
                    stackId="wealth"
                    stroke="#c2410c"
                    fill="#f97316"
                    fillOpacity={0.3}
                    strokeWidth={1}
                    isAnimationActive={false}
                    name="housingValue"
                  />
                )}
                {madeOf.hasAnnuitizedLayer && (
                  <Area
                    type="monotone"
                    dataKey="annuitizedValue"
                    stackId="wealth"
                    stroke="#64748b"
                    fill="#94a3b8"
                    fillOpacity={0.3}
                    strokeWidth={1}
                    isAnimationActive={false}
                    name="annuitizedValue"
                  />
                )}
              </>
            )}
          </ComposedChart>
        </ChartFrame>
      </div>

      {/* Legend — words, not just swatches, because the whole point of the
          "made of" lens is that not all of this money is spendable. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-600 dark:text-gray-400">
        {lens === "lasts" ? (
          <>
            <LegendSwatch color="#1e293b" label="Money you can spend" line />
            {/* Not "Target to retire on" — that exact phrase already labels
                the figure in the verdict above, and repeating it here made
                the same words mean a number in one place and a line in
                another. */}
            <LegendSwatch color="#f97316" label="Your target" dashed />
            {hasBands && (
              <LegendSwatch color="#bbf7d0" label="Range of outcomes" />
            )}
          </>
        ) : (
          <>
            <LegendSwatch color="#2563eb" label="You can spend this" />
            {madeOf.hasHousingLayer && (
              <LegendSwatch color="#f97316" label="Tied up in property" />
            )}
            {madeOf.hasAnnuitizedLayer && (
              <LegendSwatch color="#94a3b8" label="Locked in CPF LIFE" />
            )}
          </>
        )}
      </div>

      {phaseBands.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-gray-100 pt-3 text-xs text-gray-600 dark:border-gray-800 dark:text-gray-400">
          {phaseBands.map((pb) => (
            <span
              key={`legend-${pb.planId}-${pb.fromAge}`}
              className="flex items-center gap-1.5"
            >
              <span
                aria-hidden="true"
                className="inline-block h-3 w-3 rounded-sm"
                style={{ backgroundColor: pb.tint, opacity: 0.35 }}
              />
              {pb.planName} ({pb.fromAge}–{pb.toAge})
            </span>
          ))}
        </div>
      )}

      {lens === "madeOf" && (
        <JourneyRibbon
          data={deriveJourneyRibbon(fromCompositeRows(allRows), {
            depletionAge: projection.depletionAge,
            currency: displayCurrency,
          })}
        />
      )}

      {/* ——— Stress test, attached to the chart it changes ——— */}
      <div className="mt-5 border-t border-gray-100 pt-4 dark:border-gray-800">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0 max-w-prose">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Test it against bad markets
            </h3>
            <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
              Replays your plan through thousands of random market histories —
              crashes, good runs, high inflation — and counts how often the
              money holds out.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <label htmlFor="stress-iterations" className="sr-only">
              Number of simulated markets
            </label>
            <select
              id="stress-iterations"
              value={iterations}
              onChange={(e) => setIterations(Number(e.target.value))}
              disabled={mc.isRunning}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-independence-500 focus:ring-2 focus:ring-independence-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
            >
              {ITERATION_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n.toLocaleString()} markets
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={runStress}
              disabled={mc.isRunning || phases.length === 0}
              className="rounded-lg bg-independence-600 px-4 py-1.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-independence-700 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
            >
              {mc.isRunning
                ? "Running…"
                : hasBands
                  ? "Run again"
                  : "Run the test"}
            </button>
          </div>
        </div>

        <label className="mt-3 flex cursor-pointer select-none items-start gap-2.5">
          <input
            type="checkbox"
            checked={neverSellIlliquid}
            onChange={(e) => setNeverSellIlliquid(e.target.checked)}
            disabled={mc.isRunning}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-independence-600 focus:ring-independence-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Never sell my property to cover spending
            <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
              Spends only from savings. CPF is already left alone.
            </span>
          </span>
        </label>

        {mc.error && (
          <Alert variant="error" className="mt-3">
            {mc.error.message}
          </Alert>
        )}

        {mc.result && (
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            <StressStat
              label="Money held out"
              value={`${mc.result.successRate.toFixed(0)}%`}
              sub={`of ${mc.result.iterations.toLocaleString()} markets`}
              tone={mc.result.successRate >= 80 ? "good" : "warn"}
            />
            <StressStat
              label="Typical end balance"
              value={
                hideValues
                  ? HIDDEN_VALUE
                  : formatCompact(
                      mc.result.terminalBalancePercentiles.p50,
                      displayCurrency,
                    )
              }
              sub="middle outcome"
            />
            <StressStat
              label="If things go badly"
              value={
                hideValues
                  ? HIDDEN_VALUE
                  : formatCompact(
                      mc.result.terminalBalancePercentiles.p10,
                      displayCurrency,
                    )
              }
              sub="worst 1 in 10"
            />
            <StressStat
              label="Ran out"
              value={
                mc.result.depletionAgeDistribution.depletedCount > 0
                  ? `${(
                      (mc.result.depletionAgeDistribution.depletedCount /
                        mc.result.iterations) *
                      100
                    ).toFixed(0)}%`
                  : "Never"
              }
              sub={
                mc.result.depletionAgeDistribution.mostCommonDepletionAge
                  ? `usually around age ${mc.result.depletionAgeDistribution.mostCommonDepletionAge}`
                  : "in every market tested"
              }
              tone={
                mc.result.depletionAgeDistribution.depletedCount /
                  mc.result.iterations <
                0.1
                  ? "good"
                  : "warn"
              }
            />
          </dl>
        )}
      </div>
    </section>
  )
}

function LegendSwatch({
  color,
  label,
  line = false,
  dashed = false,
}: {
  color: string
  label: string
  line?: boolean
  dashed?: boolean
}): React.ReactElement {
  return (
    <span className="flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className={
          line || dashed
            ? "inline-block h-0.5 w-6"
            : "inline-block h-3 w-3 rounded-sm"
        }
        style={
          dashed
            ? {
                backgroundImage: `repeating-linear-gradient(to right, ${color} 0 6px, transparent 6px 10px)`,
              }
            : { backgroundColor: color }
        }
      />
      {label}
    </span>
  )
}

function StressStat({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub: string
  tone?: "good" | "warn"
}): React.ReactElement {
  return (
    <div>
      <dt className="text-xs text-gray-500 dark:text-gray-400">{label}</dt>
      <dd
        className={`mt-0.5 text-2xl font-bold leading-none tabular-nums ${
          tone === "good"
            ? "text-green-600 dark:text-green-400"
            : tone === "warn"
              ? "text-amber-700 dark:text-amber-400"
              : "text-gray-900 dark:text-gray-100"
        }`}
      >
        {value}
      </dd>
      <dd className="mt-1 text-xs text-gray-500 dark:text-gray-400">{sub}</dd>
    </div>
  )
}
