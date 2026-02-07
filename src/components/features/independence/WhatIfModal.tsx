import React, { useState } from "react"
import WhatIfSlider from "./WhatIfSlider"
import { WhatIfAdjustments, ScenarioOverrides } from "./types"
import { RetirementPlan } from "types/independence"
import type { RentalIncomeData } from "./useUnifiedProjection"
import { usePrivacyMode } from "@hooks/usePrivacyMode"

const HIDDEN_VALUE = "****"

type WhatIfTab = "scenarios" | "advanced"

interface WhatIfModalProps {
  isOpen: boolean
  onClose: () => void
  plan: RetirementPlan
  whatIfAdjustments: WhatIfAdjustments
  onAdjustmentsChange: (adjustments: WhatIfAdjustments) => void
  scenarioOverrides: ScenarioOverrides
  onScenarioOverridesChange: (
    updater:
      | ScenarioOverrides
      | ((prev: ScenarioOverrides) => ScenarioOverrides),
  ) => void
  onReset: () => void
  retirementAge: number
  monthlyInvestment: number
  rentalIncome?: RentalIncomeData
  currentAge?: number
}

export default function WhatIfModal({
  isOpen,
  onClose,
  plan,
  whatIfAdjustments,
  onAdjustmentsChange,
  scenarioOverrides,
  onScenarioOverridesChange,
  onReset,
  retirementAge,
  monthlyInvestment,
  rentalIncome,
  currentAge,
}: WhatIfModalProps): React.ReactElement | null {
  const { hideValues } = usePrivacyMode()
  const [activeTab, setActiveTab] = useState<WhatIfTab>("scenarios")

  if (!isOpen) return null

  const formatMoney = (v: number): string =>
    hideValues ? HIDDEN_VALUE : `$${v.toLocaleString()}`

  const updateAdjustment = <K extends keyof WhatIfAdjustments>(
    key: K,
    value: WhatIfAdjustments[K],
  ): void => {
    onAdjustmentsChange({
      ...whatIfAdjustments,
      [key]: value,
    })
  }

  const updateOverride = <K extends keyof ScenarioOverrides>(
    key: K,
    value: ScenarioOverrides[K],
  ): void => {
    onScenarioOverridesChange((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  // Get effective income values (override or plan default)
  const effectivePension =
    scenarioOverrides.pensionMonthly ?? plan.pensionMonthly ?? 0
  const effectiveSocialSecurity =
    scenarioOverrides.socialSecurityMonthly ?? plan.socialSecurityMonthly ?? 0
  const effectiveOtherIncome =
    scenarioOverrides.otherIncomeMonthly ?? plan.otherIncomeMonthly ?? 0
  const totalRentalIncome = rentalIncome?.totalMonthlyInPlanCurrency ?? 0

  // Working income (salary) affects monthly investment
  // Net income = salary + bonus - taxes (matches ContributionsStep calculation)
  const effectiveWorkingIncome =
    scenarioOverrides.workingIncomeMonthly ?? plan.workingIncomeMonthly ?? 0
  const effectiveNetIncome =
    effectiveWorkingIncome + (plan.bonusMonthly ?? 0) - (plan.taxesMonthly ?? 0)
  const workingExpenses = plan.workingExpensesMonthly ?? 0
  const investmentAllocation = plan.investmentAllocationPercent ?? 0.8

  // Calculate effective monthly investment based on salary override
  const effectiveSurplus = effectiveNetIncome - workingExpenses
  const effectiveMonthlyInvestment =
    effectiveSurplus > 0 ? effectiveSurplus * investmentAllocation : 0

  // Total independence income
  const totalIndependenceIncome =
    effectivePension +
    effectiveSocialSecurity +
    effectiveOtherIncome +
    totalRentalIncome

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

  // Check if advanced tab has changes
  const hasAdvancedChanges =
    scenarioOverrides.pensionMonthly !== undefined ||
    scenarioOverrides.socialSecurityMonthly !== undefined ||
    scenarioOverrides.otherIncomeMonthly !== undefined ||
    whatIfAdjustments.retirementAgeOffset !== 0 ||
    whatIfAdjustments.inflationOffset !== 0

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            What-If Analysis
          </h2>
          <div className="flex gap-3">
            <button
              onClick={onReset}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              <i className="fas fa-undo mr-1"></i>
              Reset
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mb-4">
          <button
            onClick={() => setActiveTab("scenarios")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "scenarios"
                ? "border-independence-500 text-independence-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <i className="fas fa-sliders-h mr-2"></i>
            Scenarios
          </button>
          <button
            onClick={() => setActiveTab("advanced")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "advanced"
                ? "border-independence-500 text-independence-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <i className="fas fa-cog mr-2"></i>
            Advanced
            {hasAdvancedChanges && (
              <span className="ml-2 w-2 h-2 bg-independence-500 rounded-full inline-block"></span>
            )}
          </button>
        </div>

        {/* Scenarios Tab */}
        {activeTab === "scenarios" && (
          <>
            {/* Monthly Expenses */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                <i className="fas fa-receipt text-red-500 mr-2"></i>
                Monthly Expenses
              </h3>
              <WhatIfSlider
                label="Expenses"
                value={whatIfAdjustments.expensesPercent}
                onChange={(v) => updateAdjustment("expensesPercent", v)}
                min={50}
                max={150}
                step={5}
                unit="%"
                formatValue={(v) =>
                  hideValues
                    ? `${v}% (${HIDDEN_VALUE})`
                    : `${v}% ($${Math.round((plan.monthlyExpenses * v) / 100).toLocaleString()}/mo)`
                }
              />
            </div>

            {/* Working Income (Salary) */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                <i className="fas fa-briefcase text-blue-500 mr-2"></i>
                Working Income
              </h3>
              <WhatIfSlider
                label="Salary"
                value={effectiveWorkingIncome}
                onChange={(v) => updateOverride("workingIncomeMonthly", v)}
                min={0}
                max={Math.max(30000, (plan.workingIncomeMonthly ?? 0) * 2)}
                step={500}
                unit=""
                formatValue={(v) => `${formatMoney(v)}/mo`}
              />
              <div className="mt-3 p-2 bg-blue-50 rounded text-sm text-blue-700">
                <strong>Monthly Investment:</strong>{" "}
                {hideValues
                  ? HIDDEN_VALUE
                  : `$${Math.round(effectiveMonthlyInvestment).toLocaleString()}/mo`}
                <span className="text-xs text-blue-500 ml-2">
                  ({Math.round(investmentAllocation * 100)}% of surplus after
                  expenses)
                </span>
              </div>
            </div>

            {/* Projection Scenarios */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                <i className="fas fa-chart-line text-independence-500 mr-2"></i>
                Projection Scenarios
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
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
                    return hideValues
                      ? `${HIDDEN_VALUE}/mo (${v}%)`
                      : `$${adjusted.toLocaleString()}/mo (${v}%)`
                  }}
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
                  label="Equity Allocation"
                  value={
                    whatIfAdjustments.equityPercent ?? defaultEquityPercent
                  }
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
          </>
        )}

        {/* Advanced Tab */}
        {activeTab === "advanced" && (
          <>
            {/* Independence Age and Inflation */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                <i className="fas fa-calendar-alt text-purple-500 mr-2"></i>
                Timeline Settings
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <WhatIfSlider
                  label="Independence Age"
                  value={whatIfAdjustments.retirementAgeOffset}
                  onChange={(v) => updateAdjustment("retirementAgeOffset", v)}
                  min={
                    currentAge !== undefined ? currentAge - retirementAge : -10
                  }
                  max={10}
                  step={1}
                  unit=" years"
                  formatValue={(v) =>
                    `${retirementAge + v} (${v >= 0 ? "+" : ""}${v})`
                  }
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
              </div>
            </div>

            {/* Independence Income Sources */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                <i className="fas fa-coins text-green-500 mr-2"></i>
                Independence Income
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                <WhatIfSlider
                  label="Pension"
                  value={effectivePension}
                  onChange={(v) => updateOverride("pensionMonthly", v)}
                  min={0}
                  max={Math.max(10000, (plan.pensionMonthly ?? 0) * 2)}
                  step={100}
                  unit=""
                  formatValue={(v) => `${formatMoney(v)}/mo`}
                />

                <WhatIfSlider
                  label="Government Benefits"
                  value={effectiveSocialSecurity}
                  onChange={(v) => updateOverride("socialSecurityMonthly", v)}
                  min={0}
                  max={Math.max(5000, (plan.socialSecurityMonthly ?? 0) * 2)}
                  step={50}
                  unit=""
                  formatValue={(v) => `${formatMoney(v)}/mo`}
                />

                <WhatIfSlider
                  label="Other Income"
                  value={effectiveOtherIncome}
                  onChange={(v) => updateOverride("otherIncomeMonthly", v)}
                  min={0}
                  max={Math.max(5000, (plan.otherIncomeMonthly ?? 0) * 2)}
                  step={50}
                  unit=""
                  formatValue={(v) => `${formatMoney(v)}/mo`}
                />

                {totalRentalIncome > 0 && (
                  <div className="flex flex-col justify-center p-3 bg-green-50 rounded-lg border border-green-200">
                    <span className="text-xs text-green-600 font-medium">
                      Property Rental (read-only)
                    </span>
                    <span
                      className={`text-sm font-semibold ${hideValues ? "text-gray-400" : "text-green-700"}`}
                    >
                      {formatMoney(totalRentalIncome)}/mo
                    </span>
                    <span className="text-xs text-green-500">
                      Configure in Accounts
                    </span>
                  </div>
                )}
              </div>
              <div className="mt-3 p-2 bg-gray-50 rounded text-sm text-gray-600">
                <strong>Total Independence Income:</strong>{" "}
                {hideValues
                  ? HIDDEN_VALUE
                  : `$${totalIndependenceIncome.toLocaleString()}/mo`}
              </div>
            </div>
          </>
        )}

        <div className="mt-6 pt-4 border-t">
          <button
            onClick={onClose}
            className="w-full py-2 bg-independence-500 text-white rounded-lg font-medium hover:bg-independence-600 transition-colors"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}
