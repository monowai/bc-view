import React from "react"
import InfoTooltip from "@components/ui/Tooltip"
import { RetirementPlan, RetirementProjection } from "types/independence"
import { HIDDEN_VALUE } from "@lib/independence/planHelpers"
import {
  RentalIncomeData,
  SustainableSpendingCard,
  SpendableAtIndependenceCard,
  SetDateOfBirthNotice,
} from "@components/features/independence"
import { applyRealReturn } from "@components/features/independence/scenario/scenarioToPayload"
import type { ScenarioState } from "@components/features/independence/scenario/types"
import { usePrivacyMode } from "@hooks/usePrivacyMode"

interface DetailsTabContentProps {
  plan: RetirementPlan
  /** Active slider-driven scenario. */
  scenario: ScenarioState
  projection: RetirementProjection | null
  rentalIncome: RentalIncomeData | undefined
  effectiveCurrency: string
  planCurrency: string
  onEditDetails: () => void
  // Headline outcome figures (Spendable at Independence) shown on My Plan.
  liquidAssets: number
  blendedReturnRate: number
  currentAge: number | undefined
  retirementAge: number
  effectiveFxRate: number
  excludedPensionFV: number
  includedPensionFvDifferential: number
}

export default function DetailsTabContent({
  plan,
  scenario,
  projection,
  rentalIncome,
  effectiveCurrency,
  planCurrency,
  onEditDetails,
  liquidAssets,
  blendedReturnRate,
  currentAge,
  retirementAge,
  effectiveFxRate,
  excludedPensionFV,
  includedPensionFvDifferential,
}: DetailsTabContentProps): React.ReactElement {
  const { hideValues } = usePrivacyMode()

  // Pull effective values from the unified scenario state. realReturn is
  // distributed across cash + equity rates via applyRealReturn.
  const rates = applyRealReturn(scenario, plan)
  const effectiveExpenses = Math.round(scenario.monthlyExpenses)
  const effectivePension = scenario.pensionMonthly
  const effectiveSocialSecurity = scenario.socialSecurityMonthly
  const effectiveOtherIncome = scenario.otherIncomeMonthly
  const effectiveInflation = scenario.inflation
  const effectiveTarget = plan.targetBalance
  const effectiveEquityReturn = rates.equityReturnRate
  const effectiveCashReturn = rates.cashReturnRate
  const effectiveHousingReturn = rates.housingReturnRate

  // Display values - always use backend planInputs (already FX-converted)
  const planInputs = projection?.planInputs
  const detailsCurrency = projection?.currency || planCurrency
  const displayExpenses = planInputs?.monthlyExpenses ?? effectiveExpenses
  const displayPension = planInputs?.pensionMonthly ?? effectivePension
  const displaySocialSecurity =
    planInputs?.socialSecurityMonthly ?? effectiveSocialSecurity
  const displayOtherIncome =
    planInputs?.otherIncomeMonthly ?? effectiveOtherIncome
  const displayRentalIncome =
    planInputs?.rentalIncomeMonthly ??
    rentalIncome?.totalMonthlyInPlanCurrency ??
    0
  const displayTarget = planInputs?.targetBalance ?? effectiveTarget ?? 0
  const displayNetMonthlyNeed = Math.max(
    0,
    displayExpenses -
      displayPension -
      displaySocialSecurity -
      displayOtherIncome -
      displayRentalIncome,
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Plan Details */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {"Plan Details"}
          </h2>
          <button
            onClick={onEditDetails}
            className="text-sm text-independence-600 hover:text-independence-700"
          >
            <i className="fas fa-edit mr-1"></i>
            Edit
          </button>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between">
            <InfoTooltip
              text={
                "Your total expected monthly spending after reaching independence, including housing, food, healthcare, and other regular costs."
              }
            >
              <span className="text-gray-500">{"Monthly Expenses"}</span>
            </InfoTooltip>
            <span
              className={`font-medium ${hideValues ? "text-gray-400" : ""}`}
            >
              {hideValues
                ? HIDDEN_VALUE
                : `${detailsCurrency}${Math.round(displayExpenses).toLocaleString()}`}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">{"Pension"}</span>
            <span
              className={`font-medium ${hideValues ? "text-gray-400" : ""}`}
            >
              {hideValues
                ? HIDDEN_VALUE
                : `${detailsCurrency}${Math.round(displayPension).toLocaleString()}`}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">{"Government Benefits"}</span>
            <span
              className={`font-medium ${hideValues ? "text-gray-400" : ""}`}
            >
              {hideValues
                ? HIDDEN_VALUE
                : `${detailsCurrency}${Math.round(displaySocialSecurity).toLocaleString()}`}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">{"Other Income"}</span>
            <span
              className={`font-medium ${hideValues ? "text-gray-400" : ""}`}
            >
              {hideValues
                ? HIDDEN_VALUE
                : `${detailsCurrency}${Math.round(displayOtherIncome).toLocaleString()}`}
            </span>
          </div>
          {displayRentalIncome > 0 && (
            <div className="flex justify-between">
              <InfoTooltip text="Net rental income from properties (after all expenses). Stops if property is liquidated.">
                <span className="text-gray-500">
                  <i className="fas fa-home text-xs mr-1"></i>
                  Property Rental
                </span>
              </InfoTooltip>
              <span
                className={`font-medium ${hideValues ? "text-gray-400" : "text-green-600"}`}
              >
                {hideValues
                  ? HIDDEN_VALUE
                  : `${detailsCurrency}${Math.round(displayRentalIncome).toLocaleString()}`}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <InfoTooltip
              text={
                "What you need from your savings each month after accounting for pension, government benefits, and other income sources."
              }
            >
              <span className="text-gray-500">{"Net Monthly Need"}</span>
            </InfoTooltip>
            <span
              className={`font-medium ${hideValues ? "text-gray-400" : "text-independence-600"}`}
            >
              {hideValues
                ? HIDDEN_VALUE
                : `${detailsCurrency}${Math.round(displayNetMonthlyNeed).toLocaleString()}`}
            </span>
          </div>
          <hr />
          <div className="flex justify-between">
            <InfoTooltip
              text={
                "Expected yearly increase in living costs. Your expenses will grow by this rate each year."
              }
            >
              <span className="text-gray-500">{"Inflation"}</span>
            </InfoTooltip>
            <span className="font-medium">
              {(effectiveInflation * 100).toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Return Rates</span>
            <span className="font-medium text-blue-600">
              E:{(effectiveEquityReturn * 100).toFixed(0)}% C:
              {(effectiveCashReturn * 100).toFixed(0)}% H:
              {(effectiveHousingReturn * 100).toFixed(0)}%
            </span>
          </div>
          <div className="flex justify-between">
            <InfoTooltip
              text={
                "Allocation-weighted return across your cash and equity mix, net of fees — the single rate that drives portfolio growth."
              }
            >
              <span className="text-gray-500">Blended Return Rate</span>
            </InfoTooltip>
            <span className="font-medium text-blue-600">
              {(blendedReturnRate * 100).toFixed(1)}%
            </span>
          </div>
          {effectiveTarget && effectiveTarget > 0 && (
            <div className="flex justify-between">
              <InfoTooltip
                text={
                  "The amount you want to have left at the end of your planning period, for a legacy or safety buffer."
                }
              >
                <span className="text-gray-500">{"Target Balance"}</span>
              </InfoTooltip>
              <span
                className={`font-medium ${hideValues ? "text-gray-400" : ""}`}
              >
                {hideValues
                  ? HIDDEN_VALUE
                  : `${detailsCurrency}${Math.round(displayTarget).toLocaleString()}`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Both headline outcome figures share one section: what you'll have to
          spend at independence, and the budget that lasts the plan. Assets by
          Category now lives on its own "Assets" tab. Without a date of birth
          the projection can't model the working years, so we surface that gap
          instead of showing misleading figures. */}
      {currentAge == null ? (
        <SetDateOfBirthNotice />
      ) : (
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            <SpendableAtIndependenceCard
              embedded
              projection={projection}
              liquidAssets={liquidAssets}
              excludedPensionFV={excludedPensionFV}
              includedPensionFvDifferential={includedPensionFvDifferential}
              effectiveFxRate={effectiveFxRate}
              currentAge={currentAge}
              retirementAge={retirementAge}
              currency={effectiveCurrency}
            />
            <SustainableSpendingCard
              embedded
              projection={projection}
              currency={effectiveCurrency}
            />
          </div>
        </div>
      )}
    </div>
  )
}
