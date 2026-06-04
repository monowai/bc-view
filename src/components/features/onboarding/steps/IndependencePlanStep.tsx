import React from "react"
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
  return (
    <div className="space-y-6">
      {/* Enable/Skip toggle. Tick follows the selected option so the user
          sees clear feedback when picking either path (previously hardcoded
          on "Yes" regardless of state — Skip felt unresponsive). */}
      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => onEnabledChange(true)}
          aria-pressed={enabled}
          className={`px-6 py-3 rounded-lg font-medium transition-colors border-2 ${
            enabled
              ? "bg-independence-600 text-white border-independence-600"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200 border-transparent"
          }`}
        >
          {enabled && <i className="fas fa-check mr-2"></i>}
          {"Yes, let's do it"}
        </button>
        <button
          type="button"
          onClick={() => onEnabledChange(false)}
          aria-pressed={!enabled}
          className={`px-6 py-3 rounded-lg font-medium transition-colors border-2 ${
            !enabled
              ? "bg-gray-700 text-white border-gray-700"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200 border-transparent"
          }`}
        >
          {!enabled && <i className="fas fa-check mr-2"></i>}
          {"Skip for now"}
        </button>
      </div>

      {enabled && (
        <div className="space-y-4 bg-gray-50 rounded-lg p-6">
          <div>
            <label
              htmlFor="independenceYearOfBirth"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {"Year of Birth"}
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
              {`Currently ${currentYear - yearOfBirth} years old`}
            </p>
          </div>

          <div>
            <label
              htmlFor="independenceMonthlyExpenses"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {`Estimated Monthly Expenses (${baseCurrency})`}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-500">$</span>
              <input
                id="independenceMonthlyExpenses"
                type="number"
                value={monthlyExpenses || ""}
                min={0}
                step={100}
                placeholder={"e.g. 3000"}
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
              {"Target Independence Age"}
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
                {
                  'A plan called "My Independence Plan" will be created with sensible defaults. You can refine it anytime from the Independence page.'
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {!enabled && (
        <div className="text-center text-sm text-gray-500">
          <p>
            {
              "No worries! You can create an independence plan anytime from the menu."
            }
          </p>
        </div>
      )}
    </div>
  )
}

export default IndependencePlanStep
