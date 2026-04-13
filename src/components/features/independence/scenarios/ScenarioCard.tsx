import React from "react"
import { WorkScenario } from "types/independence"
import { usePrivacyMode } from "@hooks/usePrivacyMode"

const HIDDEN_VALUE = "****"

interface ScenarioCardProps {
  scenario: WorkScenario
  onEdit: (scenario: WorkScenario) => void
  onDelete: (scenario: WorkScenario) => void
  onSetCurrent: (scenarioId: string) => void
}

export default function ScenarioCard({
  scenario,
  onEdit,
  onDelete,
  onSetCurrent,
}: ScenarioCardProps): React.ReactElement {
  const { hideValues } = usePrivacyMode()
  const currency = scenario.currency || "$"

  const formatMoney = (value: number): string => {
    if (hideValues) return HIDDEN_VALUE
    return `${currency}${Math.round(value).toLocaleString()}`
  }

  const netContribution = scenario.computedMonthlyContribution

  return (
    <div
      className={`bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6 ${
        scenario.isCurrent ? "ring-2 ring-independence-500" : ""
      }`}
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900">
              {scenario.name}
            </h3>
            {scenario.isCurrent && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-independence-100 text-independence-700">
                <i className="fas fa-check-circle text-independence-500 mr-1 text-[10px]"></i>
                Current
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">{currency}</p>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => onEdit(scenario)}
            className="text-gray-400 hover:text-gray-600 p-1.5"
            title="Edit scenario"
          >
            <i className="fas fa-edit text-xs"></i>
          </button>
          {!scenario.isCurrent && (
            <button
              onClick={() => onDelete(scenario)}
              className="text-red-600 hover:text-red-900 p-1.5"
              title="Delete scenario"
            >
              <i className="fas fa-trash text-xs"></i>
            </button>
          )}
          {!scenario.isCurrent && (
            <button
              onClick={() => onSetCurrent(scenario.id)}
              className="text-gray-400 hover:text-independence-600 p-1.5"
              title="Set as current scenario"
            >
              <i className="fas fa-check-circle text-xs"></i>
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Income</span>
          <span
            className={`font-medium ${hideValues ? "text-gray-400" : "text-green-600"}`}
          >
            {formatMoney(scenario.workingIncomeMonthly)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Expenses</span>
          <span className={`font-medium ${hideValues ? "text-gray-400" : ""}`}>
            {formatMoney(scenario.workingExpensesMonthly)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Taxes</span>
          <span className={`font-medium ${hideValues ? "text-gray-400" : ""}`}>
            {formatMoney(scenario.taxesMonthly)}
          </span>
        </div>
        {scenario.bonusMonthly > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Bonus (monthly avg)</span>
            <span
              className={`font-medium ${hideValues ? "text-gray-400" : "text-green-600"}`}
            >
              {formatMoney(scenario.bonusMonthly)}
            </span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Invest %</span>
          <span className="font-medium">
            {scenario.investmentAllocationPercent}%
          </span>
        </div>
      </div>

      <div className="bg-gradient-to-r from-independence-50 to-independence-100 rounded-lg p-3 border border-independence-100">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">
            <i className="fas fa-piggy-bank text-independence-500 mr-1"></i>
            Net Contribution
          </span>
          <span
            className={`font-bold ${
              hideValues
                ? "text-gray-400"
                : netContribution >= 0
                  ? "text-independence-600"
                  : "text-red-600"
            }`}
          >
            {formatMoney(netContribution)}
            <span className="text-xs font-normal text-gray-500">/mo</span>
          </span>
        </div>
      </div>
    </div>
  )
}
