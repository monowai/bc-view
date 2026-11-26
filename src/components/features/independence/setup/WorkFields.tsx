import React from "react"
import { employmentInvestment } from "@utils/independence/employmentInvestment"
import { grossIncomeHint } from "@utils/independence/messages"

export interface WorkFieldsProps {
  workingIncomeMonthly: number
  workingExpensesMonthly: number
  taxesMonthly: number
  bonusMonthly: number
  investmentAllocationPercent: number
  currency: string
  /** Monthly employee defined contribution (CPF) on the gross income; 0 when none. */
  definedContributionMonthly: number
  onWorkingIncomeMonthlyChange: (amount: number) => void
  onWorkingExpensesMonthlyChange: (amount: number) => void
  onTaxesMonthlyChange: (amount: number) => void
  onBonusMonthlyChange: (amount: number) => void
  onInvestmentAllocationPercentChange: (pct: number) => void
}

const numeric = (value: string): number => (value === "" ? 0 : Number(value))

/**
 * What the surplus that funds the plan is made of. Backend-owned figures are
 * never re-derived here — the contribution line below is a preview of the
 * arithmetic the user is doing on this screen, not a projection. The CPF
 * employee share leaves gross pay before the allocation, as in svc-retire.
 */
function monthlyContribution(
  income: number,
  expenses: number,
  taxes: number,
  bonus: number,
  allocationPct: number,
  definedContribution: number,
): number {
  const { investmentTarget } = employmentInvestment({
    surplusAfterContributions: income + bonus - expenses - taxes,
    investmentAllocationPercent: allocationPct,
    definedContribution,
  })
  return Math.round(investmentTarget)
}

/** The work-scenario fields, as onboarding collects them. */
export default function WorkFields({
  workingIncomeMonthly,
  workingExpensesMonthly,
  taxesMonthly,
  bonusMonthly,
  investmentAllocationPercent,
  currency,
  definedContributionMonthly,
  onWorkingIncomeMonthlyChange,
  onWorkingExpensesMonthlyChange,
  onTaxesMonthlyChange,
  onBonusMonthlyChange,
  onInvestmentAllocationPercentChange,
}: WorkFieldsProps): React.ReactElement {
  const contribution = monthlyContribution(
    workingIncomeMonthly,
    workingExpensesMonthly,
    taxesMonthly,
    bonusMonthly,
    investmentAllocationPercent,
    definedContributionMonthly,
  )

  const inputCls =
    "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500"

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="setupWorkingIncome"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {`Gross Monthly Income (${currency})`}
          </label>
          <input
            id="setupWorkingIncome"
            type="number"
            aria-label="Monthly income"
            value={workingIncomeMonthly || ""}
            min={0}
            step={100}
            placeholder="e.g. 8000"
            onChange={(e) =>
              onWorkingIncomeMonthlyChange(numeric(e.target.value))
            }
            className={inputCls}
          />
          <p className="mt-1 text-xs text-gray-500">{grossIncomeHint}</p>
        </div>

        <div>
          <label
            htmlFor="setupWorkingExpenses"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {`Monthly Expenses (${currency})`}
          </label>
          <input
            id="setupWorkingExpenses"
            type="number"
            aria-label="Monthly living expenses"
            value={workingExpensesMonthly || ""}
            min={0}
            step={100}
            placeholder="e.g. 4000"
            onChange={(e) =>
              onWorkingExpensesMonthlyChange(numeric(e.target.value))
            }
            className={inputCls}
          />
        </div>

        <div>
          <label
            htmlFor="setupTaxesMonthly"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {`Monthly Taxes (${currency})`}
          </label>
          <input
            id="setupTaxesMonthly"
            type="number"
            aria-label="Monthly taxes"
            value={taxesMonthly || ""}
            min={0}
            step={100}
            placeholder="e.g. 1500"
            onChange={(e) => onTaxesMonthlyChange(numeric(e.target.value))}
            className={inputCls}
          />
        </div>

        <div>
          <label
            htmlFor="setupBonusMonthly"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {`Avg Monthly Bonus (${currency})`}
          </label>
          <input
            id="setupBonusMonthly"
            type="number"
            aria-label="Average monthly bonus"
            value={bonusMonthly || ""}
            min={0}
            step={100}
            placeholder="e.g. 500"
            onChange={(e) => onBonusMonthlyChange(numeric(e.target.value))}
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="setupInvestmentAllocation"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {`Invest ${investmentAllocationPercent}% of surplus`}
        </label>
        <input
          id="setupInvestmentAllocation"
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
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      {contribution > 0 && (
        <div className="bg-independence-50 border border-independence-200 rounded-lg p-3">
          <p className="text-sm text-independence-700">
            <i aria-hidden="true" className="fas fa-piggy-bank mr-2"></i>
            {`Estimated monthly investment: ${currency} ${contribution.toLocaleString()}`}
          </p>
          {definedContributionMonthly > 0 && (
            <p className="text-xs text-independence-600 mt-1">
              {`after ${currency} ${Math.round(definedContributionMonthly).toLocaleString()} CPF from your gross pay`}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
