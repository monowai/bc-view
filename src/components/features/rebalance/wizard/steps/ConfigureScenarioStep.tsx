import React from "react"
import ScenarioSelector from "../../common/ScenarioSelector"
import { RebalanceScenario } from "types/rebalance"

interface ConfigureScenarioStepProps {
  scenario: RebalanceScenario
  onScenarioChange: (scenario: RebalanceScenario) => void
  cashDelta: number
  onCashDeltaChange: (delta: number) => void
  planCurrency: string
}

const ConfigureScenarioStep: React.FC<ConfigureScenarioStepProps> = ({
  scenario,
  onScenarioChange,
  cashDelta,
  onCashDeltaChange,
  planCurrency,
}) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900">
          {"Configure Rebalance"}
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          {"Choose how you want to rebalance your portfolios."}
        </p>
      </div>

      {/* Scenario Selector */}
      <ScenarioSelector value={scenario} onChange={onScenarioChange} />

      {/* Cash Delta */}
      <div className="space-y-2">
        <label
          htmlFor="cashDelta"
          className="block text-sm font-medium text-gray-700"
        >
          {"Cash to Deploy/Remove"}
        </label>
        <p className="text-xs text-gray-500">
          {scenario === "INVEST_CASH"
            ? "Enter the amount of cash you want to invest across your portfolios."
            : "Optionally add cash to deploy or enter a negative amount to remove."}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">{planCurrency}</span>
          <input
            id="cashDelta"
            type="number"
            value={cashDelta}
            onChange={(e) => onCashDeltaChange(parseFloat(e.target.value) || 0)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            placeholder="0.00"
          />
        </div>
        {cashDelta !== 0 && (
          <p
            className={`text-sm ${cashDelta > 0 ? "text-green-600" : "text-red-600"}`}
          >
            {cashDelta > 0
              ? `Adding ${cashDelta} to deploy`
              : `Removing ${Math.abs(cashDelta)} from portfolios`}
          </p>
        )}
      </div>

      {/* Scenario explanation */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-700 mb-2">
          {"What will happen?"}
        </h4>
        {scenario === "INVEST_CASH" ? (
          <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
            <li>{"Only BUY transactions will be generated"}</li>
            <li>{"Cash will be allocated to underweight positions"}</li>
            <li>{"Existing positions will not be sold"}</li>
          </ul>
        ) : (
          <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
            <li>{"Both BUY and SELL transactions may be generated"}</li>
            <li>{"Overweight positions may be sold to fund buys"}</li>
            <li>{"Portfolio will be brought closer to target allocation"}</li>
          </ul>
        )}
      </div>
    </div>
  )
}

export default ConfigureScenarioStep
