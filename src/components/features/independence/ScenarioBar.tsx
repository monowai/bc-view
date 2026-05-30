import React, { useState } from "react"
import type { FiMetrics } from "types/independence"
import InfoTooltip from "@components/ui/Tooltip"
import type { ScenarioState } from "./scenario/types"
import StrategyGaugesStrip from "./StrategyGaugesStrip"
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
  derivedLiquidAssets,
  planBlendedReturn,
  planInflation,
}: ScenarioBarProps): React.ReactElement {
  // Sliders default-collapse on small viewports to keep the page usable.
  // Gauges + action row stay visible at all sizes.
  const [collapsed, setCollapsed] = useState(false)

  const effectiveLiquidAssets = scenario.liquidAssets ?? derivedLiquidAssets
  const effectiveRealReturn =
    scenario.realReturn ?? planBlendedReturn - planInflation
  const liquidMax = Math.max(derivedLiquidAssets * 2, 100_000)

  return (
    <div className="sticky top-0 z-30 bg-white border-b shadow-sm mb-4">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="text-sm text-gray-500 hover:text-gray-700 md:hidden"
              aria-label={collapsed ? "Show sliders" : "Hide sliders"}
            >
              <i
                className={`fas fa-chevron-${collapsed ? "down" : "up"} mr-1`}
              ></i>
              Scenario
            </button>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide hidden md:flex items-center gap-2">
              <i className="fas fa-sliders-h text-orange-500"></i>
              Scenario
              <InfoTooltip text="Drag the sliders to model what-if questions. Every change flows into the Path projection and Stress Test simulation in real time.">
                <span></span>
              </InfoTooltip>
            </h2>
            {isDirty && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                Modified
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onReset}
              disabled={!isDirty}
              className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="fas fa-undo mr-1"></i>
              Reset
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={!isDirty}
              className="text-sm bg-independence-600 hover:bg-independence-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-md font-medium"
            >
              Save Scenario
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* Slider grid — hidden on mobile when collapsed */}
          <div
            className={`${collapsed ? "hidden md:grid" : "grid"} grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3`}
          >
            <WhatIfSlider
              label="Current Age"
              value={scenario.currentAge}
              onChange={(currentAge) => onScenarioChange({ currentAge })}
              min={25}
              max={Math.max(scenario.retirementAge - 1, 90)}
              step={1}
              unit="y"
              formatValue={(v) => `${v}y`}
            />
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
                    Math.abs(v - (planBlendedReturn - planInflation)) < 1e-6
                      ? null
                      : v,
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
          </div>

          {/* Live gauges — always visible */}
          <div>
            <StrategyGaugesStrip fiMetrics={fiMetrics} compact />
          </div>
        </div>
      </div>
    </div>
  )
}
