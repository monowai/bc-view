import React from "react"

export interface SpendingFieldsProps {
  monthlyExpenses: number
  medicalExpenses: number
  currency: string
  onMonthlyExpensesChange: (amount: number) => void
  onMedicalExpensesChange: (amount: number) => void
}

const numeric = (value: string): number => (value === "" ? 0 : Number(value))

/**
 * The two spending rows `saveOnboardingExpenses` writes: general living costs
 * under "Other", healthcare under "Healthcare". Split because the phased
 * generator ramps medical up as other spending eases — one combined figure
 * cannot be phased that way.
 *
 * Field markup mirrors the onboarding step so the two doors look like one
 * product; onboarding should adopt this component in a follow-up.
 */
export default function SpendingFields({
  monthlyExpenses,
  medicalExpenses,
  currency,
  onMonthlyExpensesChange,
  onMedicalExpensesChange,
}: SpendingFieldsProps): React.ReactElement {
  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="setupMonthlyExpenses"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {`General Monthly Expenses in Retirement (${currency})`}
        </label>
        <input
          id="setupMonthlyExpenses"
          type="number"
          aria-label="Monthly retirement expenses"
          value={monthlyExpenses || ""}
          min={0}
          step={100}
          placeholder="e.g. 3000"
          onChange={(e) => onMonthlyExpensesChange(numeric(e.target.value))}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
        />
        <p className="mt-1 text-xs text-gray-500">
          Day-to-day living costs, excluding healthcare.
        </p>
      </div>

      <div>
        <label
          htmlFor="setupMedicalExpenses"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {`Monthly Healthcare / Medical (${currency})`}
        </label>
        <input
          id="setupMedicalExpenses"
          type="number"
          aria-label="Monthly medical expenses"
          value={medicalExpenses || ""}
          min={0}
          step={50}
          placeholder="e.g. 300"
          onChange={(e) => onMedicalExpensesChange(numeric(e.target.value))}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
        />
        <p className="mt-1 text-xs text-gray-500">
          Tracked separately so later retirement phases can ramp it up as other
          spending eases.
        </p>
      </div>
    </div>
  )
}
