import React, { useState } from "react"
import type { FiMetrics, PathToHorizon } from "types/independence"
import type { ScenarioState } from "./scenario/types"
import StrategyGaugesStrip from "./StrategyGaugesStrip"
import { STRATEGY_VIEW_LABELS, type StrategyView } from "./strategyView"
import WhatIfSlider from "./WhatIfSlider"

export interface AssumptionsPanelProps {
  scenario: ScenarioState
  /** Patch one or more fields. */
  onScenarioChange: (patch: Partial<ScenarioState>) => void
  /** Restore the seeded plan values. */
  onReset: () => void
  /** Open the Save Scenario dialog (dialog is hosted by the page). */
  onSave: () => void
  /** Whether the scenario differs from the seeded baseline. */
  isDirty: boolean
  /** Plan currency code (e.g. "SGD") — used in slider value labels. */
  currency: string
  /** Live FiMetrics from the most recent projection. */
  fiMetrics?: FiMetrics
  /** Active strategy view — drives the headline gauge + FiMetrics sections. */
  view: StrategyView
  onViewChange: (next: StrategyView) => void
  /**
   * Live derived liquid assets from holdings. Acts as the slider default
   * (when `scenario.liquidAssets` is null) and as the upper anchor for the
   * slider's range.
   */
  derivedLiquidAssets: number
  /** Plan's own inflation rate, used to compute real return on Cash→Invest display. */
  planInflation: number
  /** Plan's cash return rate (e.g. 0.015 for 1.5%). */
  planCashRate: number
  /** Plan's equity return rate (e.g. 0.07 for 7%). */
  planEquityRate: number
  /** Plan's cash allocation as a decimal (e.g. 1.0 = 100% cash). */
  planCashAlloc: number
  /**
   * Off-track diagnostic from the latest projection. Present only when the
   * plan's money runs out before life expectancy. Caveats the Retirement-Age
   * Progress gauge so a high % can't read as success.
   */
  pathToHorizon?: PathToHorizon | null
}

const N0 = (n: number): string => Math.round(n).toLocaleString()
const PCT = (n: number): string => `${(n * 100).toFixed(1)}%`

/**
 * Right-hand "Assumptions" sidebar for the single-plan Independence page.
 *
 * On lg+ screens: always-visible sticky right column with all 9 scenario
 * sliders, the StrategyGaugesStrip, and the Cash→Investments education block.
 *
 * Below lg: a collapsible card that sits above the tab content (collapsed by
 * default to keep mobile chrome minimal). The same toggle-and-reveal UX as
 * the old ScenarioBar, just repositioned.
 *
 * All scenario plumbing (useScenario, scenarioToPayload, useUnifiedProjection)
 * is unchanged — this is a pure re-presentation of ScenarioBar.
 */
export default function AssumptionsPanel({
  scenario,
  onScenarioChange,
  onReset,
  onSave,
  isDirty,
  currency,
  fiMetrics,
  view,
  onViewChange,
  derivedLiquidAssets,
  planInflation,
  planCashRate,
  planEquityRate,
  planCashAlloc,
  pathToHorizon,
}: AssumptionsPanelProps): React.ReactElement {
  // Collapsed by default on mobile; on desktop CSS overrides this so content
  // is always visible regardless of the collapsed state.
  const [collapsed, setCollapsed] = useState(true)

  const offTrack = pathToHorizon != null

  const effectiveLiquidAssets = scenario.liquidAssets ?? derivedLiquidAssets
  const liquidMax = Math.max(derivedLiquidAssets * 2, 100_000)

  // Cash→Invest education line: how the blended return shifts as cash moves to equities.
  const cashShift =
    Math.max(0, Math.min(100, scenario.cashToInvestPercent ?? 0)) / 100
  const shiftedCashAlloc = planCashAlloc * (1 - cashShift)
  const shiftedEquityAlloc = 1 - planCashAlloc + planCashAlloc * cashShift
  const shiftedBlended =
    shiftedCashAlloc * planCashRate + shiftedEquityAlloc * planEquityRate
  const shiftedReal = shiftedBlended - planInflation

  // Real Return slider: show the plan's blended real return when the slider
  // hasn't been touched (realReturn === null). User drag sets an explicit
  // override; Reset restores to null (auto).
  const planBlended =
    planCashAlloc * planCashRate + (1 - planCashAlloc) * planEquityRate
  const planRealReturn = planBlended - planInflation
  const effectiveRealReturn = scenario.realReturn ?? planRealReturn

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
      {/* Header: always visible. On mobile doubles as the collapse toggle. */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-2 text-sm font-semibold text-gray-700 uppercase tracking-wide"
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Show assumptions" : "Hide assumptions"}
        >
          <i
            className={`fas fa-chevron-${collapsed ? "right" : "down"} lg:hidden text-gray-400 w-3`}
          />
          <span>Assumptions</span>
        </button>

        {isDirty && (
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium shrink-0">
            adjusted
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onReset}
            disabled={!isDirty}
            className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            <i className="fas fa-undo mr-1"></i>
            Reset
          </button>
          {isDirty && (
            <button
              type="button"
              onClick={onSave}
              className="text-sm bg-independence-600 hover:bg-independence-700 text-white px-3 py-1.5 rounded-md font-medium shrink-0"
            >
              Save Scenario
            </button>
          )}
        </div>
      </div>

      {/* Content: hidden on mobile when collapsed; always visible on desktop
          via `lg:block` overriding the `hidden` class. */}
      <div
        className={`px-4 py-4 space-y-5 ${collapsed ? "hidden lg:block" : "block"}`}
      >
        {/* Strategy gauges — live feedback on every slider drag. */}
        <StrategyGaugesStrip
          fiMetrics={fiMetrics}
          compact
          view={view}
          offTrack={offTrack}
        />

        {/* Strategy view selector */}
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <span className="shrink-0">View:</span>
          <select
            value={view}
            onChange={(e) => onViewChange(e.target.value as StrategyView)}
            className="flex-1 px-2 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-independence-500"
            aria-label="Strategy view"
          >
            {(["FIRE", "PENSION", "HYBRID", "ALL"] as StrategyView[]).map(
              (v) => (
                <option key={v} value={v}>
                  {STRATEGY_VIEW_LABELS[v]}
                </option>
              ),
            )}
          </select>
        </label>

        {/* Core assumption sliders */}
        <WhatIfSlider
          label="Retirement Age"
          value={scenario.retirementAge}
          onChange={(retirementAge) => onScenarioChange({ retirementAge })}
          min={Math.max(scenario.currentAge + 1, 40)}
          max={75}
          step={1}
          unit="y"
          formatValue={(v) => `${v}y`}
        />
        <WhatIfSlider
          label="Life Expectancy"
          value={scenario.lifeExpectancy}
          onChange={(lifeExpectancy) => onScenarioChange({ lifeExpectancy })}
          min={Math.max(scenario.retirementAge + 1, 75)}
          max={105}
          step={1}
          unit="y"
          formatValue={(v) => `${v}y`}
        />
        <WhatIfSlider
          label="Liquid Assets"
          value={effectiveLiquidAssets}
          onChange={(v) =>
            onScenarioChange({
              liquidAssets: v === derivedLiquidAssets ? null : v,
            })
          }
          min={0}
          max={liquidMax}
          step={Math.max(1000, Math.round(liquidMax / 100))}
          unit=""
          formatValue={(v) => `${currency}${N0(v)}`}
        />
        <WhatIfSlider
          label="Monthly Expenses"
          value={scenario.monthlyExpenses}
          onChange={(monthlyExpenses) => onScenarioChange({ monthlyExpenses })}
          min={0}
          max={30_000}
          step={100}
          unit=""
          formatValue={(v) => `${currency}${N0(v)}`}
        />
        {/* Expected Real Return — NEW. When scenario.realReturn is null (auto),
            the slider shows the plan's blended real return as a starting point.
            Dragging sets an explicit override; Reset restores auto. */}
        <WhatIfSlider
          label="Expected Real Return"
          value={effectiveRealReturn}
          onChange={(realReturn) => onScenarioChange({ realReturn })}
          min={-0.05}
          max={0.12}
          step={0.005}
          unit=""
          formatValue={(v) => `${v >= 0 ? "+" : ""}${PCT(v)}`}
        />
        <WhatIfSlider
          label="Government Benefits"
          value={scenario.socialSecurityMonthly}
          onChange={(socialSecurityMonthly) =>
            onScenarioChange({ socialSecurityMonthly })
          }
          min={0}
          max={10_000}
          step={50}
          unit=""
          formatValue={(v) => `${currency}${N0(v)}/mo`}
        />
        <WhatIfSlider
          label="Other Income"
          value={scenario.otherIncomeMonthly}
          onChange={(otherIncomeMonthly) =>
            onScenarioChange({ otherIncomeMonthly })
          }
          min={0}
          max={10_000}
          step={50}
          unit=""
          formatValue={(v) => `${currency}${N0(v)}/mo`}
        />
        <WhatIfSlider
          label="Inflation"
          value={scenario.inflation}
          onChange={(inflation) => onScenarioChange({ inflation })}
          min={0}
          max={0.1}
          step={0.001}
          unit=""
          formatValue={PCT}
        />

        {/* Cash → Investments: a pedagogically highlighted section showing
            the live blended return impact of reallocating cash to equities.
            Kept visually distinct so users notice the lever. */}
        <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 space-y-2">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
            Try it: move cash to investments
          </p>
          <WhatIfSlider
            label="Cash → Investments"
            value={scenario.cashToInvestPercent}
            onChange={(cashToInvestPercent) =>
              onScenarioChange({ cashToInvestPercent })
            }
            min={0}
            max={100}
            step={5}
            unit="%"
            formatValue={(v) => `${Math.round(v)}%`}
          />
          <p className="text-xs mt-0.5">
            <span className="text-gray-500">
              Expected: {PCT(shiftedBlended)} blended
            </span>
            <span
              className={
                shiftedReal >= 0 ? "text-green-600 ml-1" : "text-red-500 ml-1"
              }
            >
              {shiftedReal >= 0
                ? `+${PCT(shiftedReal)} real`
                : `${PCT(shiftedReal)} real`}
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}
