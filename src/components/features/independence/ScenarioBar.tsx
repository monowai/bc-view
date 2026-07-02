import React, { useState } from "react"
import type { FiMetrics, PathToHorizon } from "types/independence"
import InfoTooltip from "@components/ui/Tooltip"
import type { ScenarioState } from "./scenario/types"
import StrategyGaugesStrip from "./StrategyGaugesStrip"
import { STRATEGY_VIEW_LABELS, type StrategyView } from "./strategyView"
import WhatIfSlider from "./WhatIfSlider"

export interface ScenarioBarProps {
  scenario: ScenarioState
  /** Patch one or more fields. */
  onScenarioChange: (patch: Partial<ScenarioState>) => void
  /** Restore the seeded plan values. */
  onReset: () => void
  /** Open the Save Scenario dialog. */
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
   * Off-track diagnostic from the latest projection: present ONLY when the
   * plan's money runs out before life expectancy. Caveats the Retirement-Age
   * Progress gauge so a high % can't read as success. The off-track guidance
   * copy itself lives in the backend OFF_TRACK Plan Insight on My Plan.
   * Null/absent when on-track.
   */
  pathToHorizon?: PathToHorizon | null
}

const N0 = (n: number): string => Math.round(n).toLocaleString()
const PCT = (n: number): string => `${(n * 100).toFixed(1)}%`

/**
 * Sticky accordion bar at the top of the plan page. Ten sliders drive a unified
 * ScenarioState that flows into the deterministic projection (Path) and
 * the Monte Carlo simulation (Stress Test). A live strategy-gauge strip
 * sits beside the sliders so the impact of every drag is visible without
 * tab switching.
 */
export default function ScenarioBar({
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
}: ScenarioBarProps): React.ReactElement {
  // Sliders default-collapsed at every viewport to keep the page chrome
  // minimal. Gauges + action row stay visible. User clicks "Assumptions" to
  // expand the slider grid.
  const [collapsed, setCollapsed] = useState(true)

  // Off-track flag (backend-driven). Present only when the plan depletes
  // before life expectancy. The off-track guidance itself now lives in the
  // backend OFF_TRACK Plan Insight (rendered by PlanFindingsCard); here it
  // only caveats the Retirement-Age Progress gauge so a high % can't read as
  // success.
  const offTrack = pathToHorizon != null

  const effectiveLiquidAssets = scenario.liquidAssets ?? derivedLiquidAssets
  const liquidMax = Math.max(derivedLiquidAssets * 2, 100_000)

  // Compute the expected blended return for the Cash→Invest shift display.
  const cashShift =
    Math.max(0, Math.min(100, scenario.cashToInvestPercent ?? 0)) / 100
  const shiftedCashAlloc = planCashAlloc * (1 - cashShift)
  const shiftedEquityAlloc = 1 - planCashAlloc + planCashAlloc * cashShift
  const shiftedBlended =
    shiftedCashAlloc * planCashRate + shiftedEquityAlloc * planEquityRate
  const shiftedReal = shiftedBlended - planInflation

  // Expected Real Return slider: show the plan's blended real return when the
  // slider hasn't been touched (realReturn === null). User drag sets an explicit
  // override; Reset restores to null (auto).
  const planBlended =
    planCashAlloc * planCashRate + (1 - planCashAlloc) * planEquityRate
  const planRealReturn = planBlended - planInflation
  const effectiveRealReturn = scenario.realReturn ?? planRealReturn

  return (
    <div className="sticky top-0 z-30 bg-white border-b shadow-sm mb-3">
      <div className="px-4 py-2">
        {/* Headline gauge (horizontal bar). The on/off-track verdict and the
            off-track "what it takes" guidance now live in the Plan Insights
            list on My Plan (backend OFF_TRACK finding), not under the bar. */}
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <StrategyGaugesStrip
              fiMetrics={fiMetrics}
              compact
              view={view}
              singleHeadline
              offTrack={offTrack}
            />
          </div>
          {/* View selector on the progress-bar row. */}
          <label className="flex items-center gap-1 text-sm text-gray-600 shrink-0">
            <span>View:</span>
            <select
              value={view}
              onChange={(e) => onViewChange(e.target.value as StrategyView)}
              className="px-2 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-independence-500"
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
        </div>

        {/* Control row — accordion toggle on the left, view/reset/save on the
            right. Save only appears once the scenario has been altered. */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="flex items-center gap-2 text-sm font-semibold text-gray-700 uppercase tracking-wide hover:text-gray-900 shrink-0"
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Show sliders" : "Hide sliders"}
          >
            <i
              className={`fas fa-chevron-${collapsed ? "right" : "down"} text-gray-400 w-3`}
            ></i>
            <i className="fas fa-sliders-h text-orange-500"></i>
            Assumptions
          </button>
          <InfoTooltip text="Drag the sliders to model what-if questions. Every change flows into the Path projection and Stress Test simulation in real time.">
            <span></span>
          </InfoTooltip>
          {isDirty && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium shrink-0">
              Modified
            </span>
          )}

          <div className="flex items-center gap-3 ml-auto">
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

        {/* Slider grid — only when expanded. */}
        {!collapsed && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3">
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
              onChange={(lifeExpectancy) =>
                onScenarioChange({ lifeExpectancy })
              }
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
              onChange={(monthlyExpenses) =>
                onScenarioChange({ monthlyExpenses })
              }
              min={0}
              max={30_000}
              step={100}
              unit=""
              formatValue={(v) => `${currency}${N0(v)}`}
            />
            {/* Expected Real Return — when scenario.realReturn is null (auto),
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
            {/* Wealth Transfer — cash → equities. Highlighted to invite
                exploration; shows what blended return to expect given the
                plan's own rate assumptions. */}
            <div className="rounded-lg bg-amber-50 border border-amber-100 p-2 space-y-1">
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
                    shiftedReal >= 0
                      ? "text-green-600 ml-1"
                      : "text-red-500 ml-1"
                  }
                >
                  {shiftedReal >= 0
                    ? `+${PCT(shiftedReal)} real`
                    : `${PCT(shiftedReal)} real`}
                </span>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
