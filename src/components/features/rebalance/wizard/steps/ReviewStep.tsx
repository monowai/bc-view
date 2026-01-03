import React from "react"
import { useTranslation } from "next-i18next"
import { ModelDto, RebalanceScenario } from "types/rebalance"

interface ReviewStepProps {
  planName: string
  onPlanNameChange: (name: string) => void
  selectedModel: ModelDto | null
  portfolioCount: number
  scenario: RebalanceScenario
  cashDelta: number
  planCurrency: string
}

const ReviewStep: React.FC<ReviewStepProps> = ({
  planName,
  onPlanNameChange,
  selectedModel,
  portfolioCount,
  scenario,
  cashDelta,
  planCurrency,
}) => {
  const { t } = useTranslation("common")

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900">
          {t("rebalance.wizard.review", "Review & Create Plan")}
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          {t(
            "rebalance.wizard.reviewDesc",
            "Review your selections and give the plan a name.",
          )}
        </p>
      </div>

      {/* Plan Name */}
      <div>
        <label
          htmlFor="planName"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {t("rebalance.plans.name", "Plan Name")} *
        </label>
        <input
          id="planName"
          type="text"
          value={planName}
          onChange={(e) => onPlanNameChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          placeholder={t(
            "rebalance.wizard.planNamePlaceholder",
            "e.g., Q1 2024 Rebalance",
          )}
        />
      </div>

      {/* Summary */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b">
          <h4 className="font-medium text-gray-700">
            {t("rebalance.wizard.summary", "Plan Summary")}
          </h4>
        </div>
        <div className="divide-y divide-gray-200">
          <div className="px-4 py-3 flex justify-between">
            <span className="text-gray-600">
              {t("rebalance.wizard.model", "Model Portfolio")}
            </span>
            <span className="font-medium">{selectedModel?.name || "-"}</span>
          </div>
          <div className="px-4 py-3 flex justify-between">
            <span className="text-gray-600">
              {t("rebalance.wizard.portfolioCount", "Portfolios")}
            </span>
            <span className="font-medium">{portfolioCount}</span>
          </div>
          <div className="px-4 py-3 flex justify-between">
            <span className="text-gray-600">
              {t("rebalance.wizard.scenario", "Scenario")}
            </span>
            <span className="font-medium">
              {scenario === "INVEST_CASH"
                ? t("rebalance.scenario.investCash", "Invest Cash Only")
                : t("rebalance.scenario.rebalance", "Full Rebalance")}
            </span>
          </div>
          {cashDelta !== 0 && (
            <div className="px-4 py-3 flex justify-between">
              <span className="text-gray-600">
                {t("rebalance.wizard.cashDelta", "Cash Delta")}
              </span>
              <span
                className={`font-medium ${cashDelta > 0 ? "text-green-600" : "text-red-600"}`}
              >
                {cashDelta > 0 ? "+" : ""}
                {planCurrency} {cashDelta.toLocaleString()}
              </span>
            </div>
          )}
          <div className="px-4 py-3 flex justify-between">
            <span className="text-gray-600">
              {t("rebalance.wizard.currency", "Plan Currency")}
            </span>
            <span className="font-medium">{planCurrency}</span>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <i className="fas fa-info-circle text-blue-500 mt-0.5"></i>
          <div className="text-sm text-blue-700">
            <p>
              {t(
                "rebalance.wizard.createInfo",
                "After creating the plan, you can review the calculated items, adjust exclusions, set execution prices, and execute when ready.",
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ReviewStep
