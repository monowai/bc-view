import React from "react"
const currentYear = new Date().getFullYear()

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

export interface IndependencePlanStepProps {
  enabled: boolean
  hideToggle?: boolean
  /**
   * When true (a CPF pension was set up), date of birth is mandatory and the
   * fields are shown even if the user skips the independence plan — CPF
   * contribution rates are age-banded.
   */
  cpfRequiresDob?: boolean
  yearOfBirth: number
  monthOfBirth: number
  monthlyExpenses: number
  medicalExpenses: number
  targetRetirementAge: number
  workingIncomeMonthly: number
  workingExpensesMonthly: number
  taxesMonthly: number
  bonusMonthly: number
  investmentAllocationPercent: number
  onEnabledChange: (enabled: boolean) => void
  onYearOfBirthChange: (year: number) => void
  onMonthOfBirthChange: (month: number) => void
  onMonthlyExpensesChange: (amount: number) => void
  onMedicalExpensesChange: (amount: number) => void
  onTargetRetirementAgeChange: (age: number) => void
  onWorkingIncomeMonthlyChange: (amount: number) => void
  onWorkingExpensesMonthlyChange: (amount: number) => void
  onTaxesMonthlyChange: (amount: number) => void
  onBonusMonthlyChange: (amount: number) => void
  onInvestmentAllocationPercentChange: (pct: number) => void
  baseCurrency: string
}

function computeMonthlyContribution(
  income: number,
  expenses: number,
  taxes: number,
  bonus: number,
  allocationPct: number,
): number {
  const surplus = income + bonus - expenses - taxes
  return Math.round(Math.max(0, surplus) * (allocationPct / 100))
}

const IndependencePlanStep: React.FC<IndependencePlanStepProps> = ({
  enabled,
  hideToggle = false,
  cpfRequiresDob = false,
  yearOfBirth,
  monthOfBirth,
  monthlyExpenses,
  medicalExpenses,
  targetRetirementAge,
  workingIncomeMonthly,
  workingExpensesMonthly,
  taxesMonthly,
  bonusMonthly,
  investmentAllocationPercent,
  onEnabledChange,
  onYearOfBirthChange,
  onMonthOfBirthChange,
  onMonthlyExpensesChange,
  onMedicalExpensesChange,
  onTargetRetirementAgeChange,
  onWorkingIncomeMonthlyChange,
  onWorkingExpensesMonthlyChange,
  onTaxesMonthlyChange,
  onBonusMonthlyChange,
  onInvestmentAllocationPercentChange,
  baseCurrency,
}) => {
  const monthlyContribution = computeMonthlyContribution(
    workingIncomeMonthly,
    workingExpensesMonthly,
    taxesMonthly,
    bonusMonthly,
    investmentAllocationPercent,
  )

  const dateOfBirthSection = (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {"Date of Birth"}
      </label>
      <div className="grid grid-cols-2 gap-3">
        <select
          id="independenceMonthOfBirth"
          aria-label="Month of birth"
          value={monthOfBirth}
          onChange={(e) => onMonthOfBirthChange(Number(e.target.value))}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
        >
          {MONTHS.map((label, i) => (
            <option key={label} value={i + 1}>
              {label}
            </option>
          ))}
        </select>
        <input
          id="independenceYearOfBirth"
          type="number"
          aria-label="Year of birth"
          value={yearOfBirth}
          min={1920}
          max={currentYear - 18}
          onChange={(e) => onYearOfBirthChange(Number(e.target.value))}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
        />
      </div>
      <p className="mt-1 text-sm text-gray-500">
        {`Currently ${currentYear - yearOfBirth} years old`}
      </p>
      {cpfRequiresDob && (
        <p className="mt-1 text-sm text-amber-700">
          <i className="fas fa-circle-info mr-1"></i>
          {"Required to calculate your CPF contributions."}
        </p>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      {!hideToggle && (
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
      )}

      {enabled && (
        <div className="space-y-6">
          {/* Section 1: Independence Settings — goal definition first */}
          <div className="bg-gray-50 rounded-lg p-6 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              {"Independence Settings"}
            </h3>

            {dateOfBirthSection}

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
                aria-label="Target independence age"
                value={targetRetirementAge}
                min={18}
                max={100}
                onChange={(e) =>
                  onTargetRetirementAgeChange(Number(e.target.value))
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
              />
            </div>

            <div>
              <label
                htmlFor="independenceMonthlyExpenses"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {`General Monthly Expenses in Retirement (${baseCurrency})`}
              </label>
              <input
                id="independenceMonthlyExpenses"
                type="number"
                aria-label="Monthly retirement expenses"
                value={monthlyExpenses || ""}
                min={0}
                step={100}
                placeholder={"e.g. 3000"}
                onChange={(e) =>
                  onMonthlyExpensesChange(
                    e.target.value === "" ? 0 : Number(e.target.value),
                  )
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                {"Day-to-day living costs, excluding healthcare."}
              </p>
            </div>

            <div>
              <label
                htmlFor="independenceMedicalExpenses"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {`Monthly Healthcare / Medical (${baseCurrency})`}
              </label>
              <input
                id="independenceMedicalExpenses"
                type="number"
                aria-label="Monthly medical expenses"
                value={medicalExpenses || ""}
                min={0}
                step={50}
                placeholder={"e.g. 300"}
                onChange={(e) =>
                  onMedicalExpensesChange(
                    e.target.value === "" ? 0 : Number(e.target.value),
                  )
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                {
                  "Tracked separately so later retirement phases can ramp it up as other spending eases."
                }
              </p>
            </div>
          </div>

          {/* Section 2: Working Situation */}
          <div className="bg-gray-50 rounded-lg p-6 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              {"Working Situation"}
            </h3>
            <p className="text-xs text-gray-500">
              {
                "How much do you earn and spend today? Used to project your savings runway."
              }
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="workingIncome"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  {`Monthly Income (${baseCurrency})`}
                </label>
                <input
                  id="workingIncome"
                  type="number"
                  aria-label="Monthly income"
                  value={workingIncomeMonthly || ""}
                  min={0}
                  step={100}
                  placeholder={"e.g. 8000"}
                  onChange={(e) =>
                    onWorkingIncomeMonthlyChange(
                      e.target.value === "" ? 0 : Number(e.target.value),
                    )
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
                />
              </div>

              <div>
                <label
                  htmlFor="workingExpenses"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  {`Monthly Expenses (${baseCurrency})`}
                </label>
                <input
                  id="workingExpenses"
                  type="number"
                  aria-label="Monthly living expenses"
                  value={workingExpensesMonthly || ""}
                  min={0}
                  step={100}
                  placeholder={"e.g. 4000"}
                  onChange={(e) =>
                    onWorkingExpensesMonthlyChange(
                      e.target.value === "" ? 0 : Number(e.target.value),
                    )
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
                />
              </div>

              <div>
                <label
                  htmlFor="taxesMonthly"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  {`Monthly Taxes (${baseCurrency})`}
                </label>
                <input
                  id="taxesMonthly"
                  type="number"
                  aria-label="Monthly taxes"
                  value={taxesMonthly || ""}
                  min={0}
                  step={100}
                  placeholder={"e.g. 1500"}
                  onChange={(e) =>
                    onTaxesMonthlyChange(
                      e.target.value === "" ? 0 : Number(e.target.value),
                    )
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
                />
              </div>

              <div>
                <label
                  htmlFor="bonusMonthly"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  {`Avg Monthly Bonus (${baseCurrency})`}
                </label>
                <input
                  id="bonusMonthly"
                  type="number"
                  aria-label="Average monthly bonus"
                  value={bonusMonthly || ""}
                  min={0}
                  step={100}
                  placeholder={"e.g. 500"}
                  onChange={(e) =>
                    onBonusMonthlyChange(
                      e.target.value === "" ? 0 : Number(e.target.value),
                    )
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="investmentAllocation"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {`Invest ${investmentAllocationPercent}% of surplus`}
              </label>
              <input
                id="investmentAllocation"
                type="range"
                aria-label="Investment allocation percent"
                value={investmentAllocationPercent}
                min={0}
                max={100}
                step={5}
                onChange={(e) =>
                  onInvestmentAllocationPercentChange(Number(e.target.value))
                }
                className="w-full accent-independence-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>{"0%"}</span>
                <span>{"50%"}</span>
                <span>{"100%"}</span>
              </div>
            </div>

            {monthlyContribution > 0 && (
              <div className="bg-independence-50 border border-independence-200 rounded-lg p-3">
                <p className="text-sm text-independence-700">
                  <i className="fas fa-piggy-bank mr-2"></i>
                  {`Estimated monthly investment: ${baseCurrency} ${monthlyContribution.toLocaleString()}`}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {!enabled && cpfRequiresDob && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 space-y-2">
          <p className="text-sm text-amber-800">
            {
              "You set up a CPF pension. Confirm your date of birth below so we can calculate your CPF contributions."
            }
          </p>
          {dateOfBirthSection}
        </div>
      )}

      {!enabled && !hideToggle && (
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
