import React, { useState } from "react"
import type { FiMetrics } from "types/independence"
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
  /**
   * Plan blended return rate (cash + equity, weighted). Used to seed the
   * realReturn slider's initial position when the user hasn't moved it.
   */
  planBlendedReturn: number
  /** Plan's own inflation rate, used to anchor realReturn = blended − inflation. */
  planInflation: number
}

const N0 = (n: number): string => Math.round(n).toLocaleString()
const PCT = (n: number): string => `${(n * 100).toFixed(1)}%`

/**
 * Sticky panel at the top of the plan page. Nine sliders drive a unified
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
  planBlendedReturn,
  planInflation,
}: ScenarioBarProps): React.ReactElement {
  // Sliders default-collapsed at every viewport to keep the page chrome
  // minimal. Gauges + action row stay visible. User clicks "Scenario" to
  // expand the slider grid.
  const [collapsed, setCollapsed] = useState(true)

  const effectiveLiquidAssets = scenario.liquidAssets ?? derivedLiquidAssets
  const planRealReturn = planBlendedReturn - planInflation
  const effectiveRealReturn = scenario.realReturn ?? planRealReturn
  const liquidMax = Math.max(derivedLiquidAssets * 2, 100_000)
  // Slider snaps to nearest 0.001; treat anything within half a step of the
  // plan's real return as "matches plan" and restore the null override so
  // the isDirty badge clears.
  const REAL_RETURN_SNAP = 0.0005

  return (
    <div className="sticky top-0 z-30 bg-white border-b shadow-sm mb-3">
      <div className="px-4 py-2">
        {/* Headline gauge (horizontal bar) on its own row. */}
        <div className="mb-2">
          <StrategyGaugesStrip
            fiMetrics={fiMetrics}
            compact
            view={view}
            singleHeadline
          />
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
            Scenario
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
            <WhatIfSlider
              label="Pension / CPF"
              value={scenario.pensionMonthly}
              onChange={(pensionMonthly) =>
                onScenarioChange({ pensionMonthly })
              }
              min={0}
              max={10_000}
              step={50}
              unit=""
              formatValue={(v) => `${currency}${N0(v)}/mo`}
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
              label="Real Return"
              value={Math.round(effectiveRealReturn * 1000) / 1000}
              onChange={(v) =>
                onScenarioChange({
                  realReturn:
                    Math.abs(v - planRealReturn) < REAL_RETURN_SNAP ? null : v,
                })
              }
              min={0}
              max={0.12}
              step={0.001}
              unit=""
              formatValue={PCT}
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
            {/* Wealth Transfer — cash → equities. Surfaces a Singapore-flavoured
                question: "what if I moved part of my bank cash into
                investments?" Slider stays at 0 (no shift) by default; moving
                it changes plan.cashAllocation / equityAllocation via
                scenarioToPayload. Future siblings (OA → SA, ETF → CPF VC)
                will live alongside this once we generalise to
                wealthTransfers[]. */}
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
          </div>
        )}
      </div>
    </div>
  )
}
