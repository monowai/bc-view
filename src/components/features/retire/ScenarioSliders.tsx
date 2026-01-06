import React from "react"
import WhatIfSlider from "./WhatIfSlider"
import { WhatIfAdjustments } from "./types"
import { RetirementPlan } from "types/retirement"

interface ScenarioSlidersProps {
  plan: RetirementPlan
  whatIfAdjustments: WhatIfAdjustments
  onAdjustmentsChange: (adjustments: WhatIfAdjustments) => void
  onReset: () => void
  retirementAge: number
  monthlyInvestment: number
}

export default function ScenarioSliders({
  plan,
  whatIfAdjustments,
  onAdjustmentsChange,
  onReset,
  retirementAge,
  monthlyInvestment,
}: ScenarioSlidersProps): React.ReactElement {
  const updateAdjustment = <K extends keyof WhatIfAdjustments>(
    key: K,
    value: WhatIfAdjustments[K],
  ): void => {
    onAdjustmentsChange({
      ...whatIfAdjustments,
      [key]: value,
    })
  }

  // Calculate base return rate for display
  const baseReturnRate =
    (plan.equityReturnRate * plan.equityAllocation +
      plan.cashReturnRate * plan.cashAllocation +
      plan.housingReturnRate * plan.housingAllocation) *
    100

  // Calculate default equity percent from plan allocations
  const defaultEquityPercent = Math.round(
    (plan.equityAllocation / (plan.equityAllocation + plan.cashAllocation)) *
      100,
  )

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          What-If Analysis
        </h2>
        <button
          onClick={onReset}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          <i className="fas fa-undo mr-1"></i>
          Reset
        </button>
      </div>

      <div className="space-y-6">
        <WhatIfSlider
          label="Retirement Age"
          value={whatIfAdjustments.retirementAgeOffset}
          onChange={(v) => updateAdjustment("retirementAgeOffset", v)}
          min={-5}
          max={10}
          step={1}
          unit=" years"
          formatValue={(v) => `${retirementAge + v} (${v >= 0 ? "+" : ""}${v})`}
        />

        <WhatIfSlider
          label="Employment Investment"
          value={whatIfAdjustments.contributionPercent}
          onChange={(v) => updateAdjustment("contributionPercent", v)}
          min={0}
          max={200}
          step={10}
          unit="%"
          formatValue={(v) => {
            const adjusted = Math.round(monthlyInvestment * (v / 100))
            return `$${adjusted.toLocaleString()}/mo (${v}%)`
          }}
        />

        <WhatIfSlider
          label="Monthly Expenses"
          value={whatIfAdjustments.expensesPercent}
          onChange={(v) => updateAdjustment("expensesPercent", v)}
          min={50}
          max={150}
          step={5}
          unit="%"
          formatValue={(v) =>
            `${v}% ($${Math.round((plan.monthlyExpenses * v) / 100).toLocaleString()})`
          }
        />

        <WhatIfSlider
          label="Investment Returns"
          value={whatIfAdjustments.returnRateOffset}
          onChange={(v) => updateAdjustment("returnRateOffset", v)}
          min={-4}
          max={4}
          step={0.5}
          unit="%"
          formatValue={(v) => {
            const adjusted = baseReturnRate + v
            return `${adjusted.toFixed(1)}% (${v >= 0 ? "+" : ""}${v})`
          }}
        />

        <WhatIfSlider
          label="Inflation Rate"
          value={whatIfAdjustments.inflationOffset}
          onChange={(v) => updateAdjustment("inflationOffset", v)}
          min={-2}
          max={4}
          step={0.5}
          unit="%"
          formatValue={(v) => {
            const baseRate = plan.inflationRate * 100
            const adjusted = baseRate + v
            return `${adjusted.toFixed(1)}% (${v >= 0 ? "+" : ""}${v})`
          }}
        />

        <WhatIfSlider
          label="Equity Allocation"
          value={whatIfAdjustments.equityPercent ?? defaultEquityPercent}
          onChange={(v) => updateAdjustment("equityPercent", v)}
          min={0}
          max={100}
          step={5}
          unit="%"
          formatValue={(v) => {
            const cashPct = 100 - v
            return `${v}% Equity / ${cashPct}% Cash`
          }}
        />
      </div>
    </div>
  )
}
