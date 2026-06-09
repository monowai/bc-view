import React from "react"
import InfoTooltip from "@components/ui/Tooltip"
import { RetirementPlan, RetirementProjection } from "types/independence"
import { AllocationSlice } from "@lib/allocation/aggregateHoldings"
import { HIDDEN_VALUE, PensionProjection } from "@lib/independence/planHelpers"
import { CpfSubAccountRow } from "@lib/independence/cpfSubAccountTags"
import {
  RentalIncomeData,
  AssetsBreakdown,
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
  // Props for Assets by Category — swapped in from the Metrics tab.
  categorySlices: AllocationSlice[]
  spendableCategories: string[]
  onToggleCategory: (category: string) => void
  pensionProjections: PensionProjection[]
  totalAssets: number
  liquidAssets: number
  blendedReturnRate: number
  currentAge: number | undefined
  retirementAge: number
  effectiveFxRate: number
  isCalculating: boolean
  holdingsLoaded: boolean
  usingManualAssets: boolean
  isRefreshingHoldings: boolean
  onRefreshHoldings: () => void
  excludedPensionFV: number
  includedPensionFvDifferential: number
  /**
   * Sub-account rows grouped by the category-slice key their CPF parent
   * resolves to (e.g. "Retirement Fund"). Empty when the user has no CPF
   * policy — the parent slice then renders without a chevron expander.
   */
  cpfSubAccountsByCategoryKey?: Record<string, CpfSubAccountRow[]>
  /**
   * Caller doesn't own the plan. Per-category holdings can't be resolved
   * server-side under the M2M path today, so the breakdown panel hides
   * (showing the viewer's caller-scoped categories would be the same leak
   * we just plugged on the projection request). Plan-detail values + the
   * projection's owner-scoped totals remain visible.
   */
  isSharedPlan?: boolean
}

export default function DetailsTabContent({
  plan,
  scenario,
  projection,
  rentalIncome,
  effectiveCurrency,
  planCurrency,
  onEditDetails,
  categorySlices,
  spendableCategories,
  onToggleCategory,
  pensionProjections,
  totalAssets,
  liquidAssets,
  blendedReturnRate,
  currentAge,
  retirementAge,
  effectiveFxRate,
  isCalculating,
  holdingsLoaded,
  usingManualAssets,
  isRefreshingHoldings,
  onRefreshHoldings,
  excludedPensionFV,
  includedPensionFvDifferential,
  cpfSubAccountsByCategoryKey,
  isSharedPlan = false,
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
          {planInputs?.definedContribution != null &&
            planInputs.definedContribution > 0 && (
              <div className="flex justify-between">
                <InfoTooltip text="CPF employee contribution deducted from your investable income while you're still working. Stops at retirement age.">
                  <span className="text-gray-500">
                    <i className="fas fa-building text-xs mr-1"></i>
                    CPF Employee Deduction
                  </span>
                </InfoTooltip>
                <span
                  className={`font-medium ${hideValues ? "text-gray-400" : "text-teal-600"}`}
                >
                  {hideValues
                    ? HIDDEN_VALUE
                    : `-${detailsCurrency}${Math.round(planInputs.definedContribution).toLocaleString()}`}
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

      {/* Assets by Category — swapped in from the Metrics tab.
          For shared plans we filter to portfolios owned by the plan
          owner (via accepted portfolio shares). When the caller has
          plan-share but no portfolio-shares, categorySlices is empty —
          show a small notice explaining what's missing. */}
      {isSharedPlan && categorySlices.length === 0 ? (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900">
          <p className="font-medium mb-1">
            <i className="fas fa-share-alt mr-2"></i>
            Owner-scoped projection
          </p>
          <p>
            Per-category asset breakdown for this shared plan needs the plan
            owner to also share their portfolios with you. The projection (left
            panel and Metrics tab) uses the owner&apos;s holdings via a
            server-side fetch.
          </p>
        </div>
      ) : (
        <AssetsBreakdown
          projection={projection}
          categorySlices={categorySlices}
          spendableCategories={spendableCategories}
          onToggleCategory={onToggleCategory}
          pensionProjections={pensionProjections}
          totalAssets={totalAssets}
          liquidAssets={liquidAssets}
          blendedReturnRate={blendedReturnRate}
          currentAge={currentAge}
          retirementAge={retirementAge}
          effectiveCurrency={effectiveCurrency}
          effectiveFxRate={effectiveFxRate}
          isCalculating={isCalculating}
          holdingsLoaded={holdingsLoaded}
          usingManualAssets={usingManualAssets}
          isRefreshingHoldings={isRefreshingHoldings}
          onRefreshHoldings={onRefreshHoldings}
          excludedPensionFV={excludedPensionFV}
          includedPensionFvDifferential={includedPensionFvDifferential}
          cpfSubAccountsByCategoryKey={cpfSubAccountsByCategoryKey}
        />
      )}
    </div>
  )
}
