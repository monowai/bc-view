import React from "react"
import { useTranslation } from "next-i18next"
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
  const { t } = useTranslation("common")

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900">
          {t("rebalance.wizard.configure", "Configure Rebalance")}
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          {t(
            "rebalance.wizard.configureDesc",
            "Choose how you want to rebalance your portfolios.",
          )}
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
          {t("rebalance.wizard.cashDelta", "Cash to Deploy/Remove")}
        </label>
        <p className="text-xs text-gray-500">
          {scenario === "INVEST_CASH"
            ? t(
                "rebalance.wizard.cashDeltaInvestDesc",
                "Enter the amount of cash you want to invest across your portfolios.",
              )
            : t(
                "rebalance.wizard.cashDeltaRebalanceDesc",
                "Optionally add cash to deploy or enter a negative amount to remove.",
              )}
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
              ? t(
                  "rebalance.wizard.cashAdd",
                  "Adding {{amount}} to deploy",
                  { amount: cashDelta.toLocaleString() },
                )
              : t(
                  "rebalance.wizard.cashRemove",
                  "Removing {{amount}} from portfolios",
                  { amount: Math.abs(cashDelta).toLocaleString() },
                )}
          </p>
        )}
      </div>

      {/* Scenario explanation */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-700 mb-2">
          {t("rebalance.wizard.whatHappens", "What will happen?")}
        </h4>
        {scenario === "INVEST_CASH" ? (
          <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
            <li>
              {t(
                "rebalance.wizard.investCash1",
                "Only BUY transactions will be generated",
              )}
            </li>
            <li>
              {t(
                "rebalance.wizard.investCash2",
                "Cash will be allocated to underweight positions",
              )}
            </li>
            <li>
              {t(
                "rebalance.wizard.investCash3",
                "Existing positions will not be sold",
              )}
            </li>
          </ul>
        ) : (
          <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
            <li>
              {t(
                "rebalance.wizard.rebalance1",
                "Both BUY and SELL transactions may be generated",
              )}
            </li>
            <li>
              {t(
                "rebalance.wizard.rebalance2",
                "Overweight positions may be sold to fund buys",
              )}
            </li>
            <li>
              {t(
                "rebalance.wizard.rebalance3",
                "Portfolio will be brought closer to target allocation",
              )}
            </li>
          </ul>
        )}
      </div>
    </div>
  )
}

export default ConfigureScenarioStep
