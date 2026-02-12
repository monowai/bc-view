import React from "react"
import { useTranslation } from "next-i18next"

const currentYear = new Date().getFullYear()

interface IndependencePlanStepProps {
  enabled: boolean
  yearOfBirth: number
  monthlyExpenses: number
  targetRetirementAge: number
  onEnabledChange: (enabled: boolean) => void
  onYearOfBirthChange: (year: number) => void
  onMonthlyExpensesChange: (amount: number) => void
  onTargetRetirementAgeChange: (age: number) => void
  baseCurrency: string
}

const IndependencePlanStep: React.FC<IndependencePlanStepProps> = ({
  enabled,
  yearOfBirth,
  monthlyExpenses,
  targetRetirementAge,
  onEnabledChange,
  onYearOfBirthChange,
  onMonthlyExpensesChange,
  onTargetRetirementAgeChange,
  baseCurrency,
}) => {
  const { t } = useTranslation("onboarding")

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-4xl mb-4 text-independence-500">
          <i className="fas fa-chart-line"></i>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {t(
            "independence.title",
            "Quick Independence Check",
          )}
        </h2>
        <p className="text-gray-600">
          {t(
            "independence.description",
            "Want to see how your finances might look in retirement? Just three quick questions.",
          )}
        </p>
      </div>

      {/* Enable/Skip toggle */}
      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => onEnabledChange(true)}
          className={`px-6 py-3 rounded-lg font-medium transition-colors ${
            enabled
              ? "bg-independence-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          <i className="fas fa-check mr-2"></i>
          {t("independence.yesPlease", "Yes, let's do it")}
        </button>
        <button
          type="button"
          onClick={() => onEnabledChange(false)}
          className={`px-6 py-3 rounded-lg font-medium transition-colors ${
            !enabled
              ? "bg-gray-200 text-gray-700"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {t("independence.skip", "Skip for now")}
        </button>
      </div>

      {enabled && (
        <div className="space-y-4 bg-gray-50 rounded-lg p-6">
          <div>
            <label
              htmlFor="independenceYearOfBirth"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {t("independence.yearOfBirth", "Year of Birth")}
            </label>
            <input
              id="independenceYearOfBirth"
              type="number"
              value={yearOfBirth}
              min={1920}
              max={currentYear - 18}
              onChange={(e) => onYearOfBirthChange(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
            />
            <p className="mt-1 text-sm text-gray-500">
              {t("independence.currentAge", "Currently {{age}} years old", {
                age: currentYear - yearOfBirth,
              })}
            </p>
          </div>

          <div>
            <label
              htmlFor="independenceMonthlyExpenses"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {t(
                "independence.monthlyExpenses",
                "Estimated Monthly Expenses ({{currency}})",
                { currency: baseCurrency },
              )}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-500">$</span>
              <input
                id="independenceMonthlyExpenses"
                type="number"
                value={monthlyExpenses || ""}
                min={0}
                step={100}
                placeholder={t(
                  "independence.expensesPlaceholder",
                  "e.g. 3000",
                )}
                onChange={(e) =>
                  onMonthlyExpensesChange(
                    e.target.value === "" ? 0 : Number(e.target.value),
                  )
                }
                className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="independenceTargetAge"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {t(
                "independence.targetAge",
                "Target Independence Age",
              )}
            </label>
            <input
              id="independenceTargetAge"
              type="number"
              value={targetRetirementAge}
              min={18}
              max={100}
              onChange={(e) =>
                onTargetRetirementAgeChange(Number(e.target.value))
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
            />
          </div>

          <div className="bg-independence-50 border border-independence-200 rounded-lg p-3">
            <div className="flex items-start">
              <i className="fas fa-info-circle text-independence-600 mt-0.5 mr-2"></i>
              <p className="text-sm text-independence-700">
                {t(
                  "independence.hint",
                  "A plan called \"My Independence Plan\" will be created with sensible defaults. You can refine it anytime from the Independence page.",
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {!enabled && (
        <div className="text-center text-sm text-gray-500">
          <p>
            {t(
              "independence.skipHint",
              "No worries! You can create an independence plan anytime from the menu.",
            )}
          </p>
        </div>
      )}
    </div>
  )
}

export default IndependencePlanStep
