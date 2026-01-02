import React from "react"
import { useTranslation } from "next-i18next"
import { RebalanceScenario } from "types/rebalance"

interface ScenarioSelectorProps {
  value: RebalanceScenario
  onChange: (scenario: RebalanceScenario) => void
}

const ScenarioSelector: React.FC<ScenarioSelectorProps> = ({
  value,
  onChange,
}) => {
  const { t } = useTranslation("common")

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        {t("rebalance.scenario.label", "Rebalance Scenario")}
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onChange("INVEST_CASH")}
          className={`p-4 border-2 rounded-lg text-left transition-colors ${
            value === "INVEST_CASH"
              ? "border-blue-500 bg-blue-50"
              : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <i className="fas fa-plus-circle text-green-500"></i>
            <span className="font-medium">
              {t("rebalance.scenario.investCash", "Invest Cash Only")}
            </span>
          </div>
          <p className="text-sm text-gray-600">
            {t(
              "rebalance.scenario.investCashDesc",
              "Deploy cash without selling existing positions",
            )}
          </p>
        </button>
        <button
          type="button"
          onClick={() => onChange("REBALANCE")}
          className={`p-4 border-2 rounded-lg text-left transition-colors ${
            value === "REBALANCE"
              ? "border-blue-500 bg-blue-50"
              : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <i className="fas fa-balance-scale text-blue-500"></i>
            <span className="font-medium">
              {t("rebalance.scenario.rebalance", "Full Rebalance")}
            </span>
          </div>
          <p className="text-sm text-gray-600">
            {t(
              "rebalance.scenario.rebalanceDesc",
              "May generate both buy and sell transactions",
            )}
          </p>
        </button>
      </div>
    </div>
  )
}

export default ScenarioSelector
