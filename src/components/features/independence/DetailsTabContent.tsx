import React from "react"
import { useTranslation } from "next-i18next"
import InfoTooltip from "@components/ui/Tooltip"
import { RetirementPlan, RetirementProjection } from "types/independence"
import { HIDDEN_VALUE } from "@lib/independence/planHelpers"
import {
  WhatIfAdjustments,
  ScenarioOverrides,
  RentalIncomeData,
} from "@components/features/independence"
import { usePrivacyMode } from "@hooks/usePrivacyMode"

interface DetailsTabContentProps {
  plan: RetirementPlan
  scenarioOverrides: ScenarioOverrides
  combinedAdjustments: WhatIfAdjustments
  projection: RetirementProjection | null
  rentalIncome: RentalIncomeData | undefined
  effectiveCurrency: string
  planCurrency: string
  onEditDetails: () => void
}

export default function DetailsTabContent({
  plan,
  scenarioOverrides,
  combinedAdjustments,
  projection,
  rentalIncome,
  effectiveCurrency,
  planCurrency,
  onEditDetails,
}: DetailsTabContentProps): React.ReactElement {
  const { t } = useTranslation("common")
  const { hideValues } = usePrivacyMode()

  // Use in-memory state (scenarioOverrides) with plan as fallback
  // Apply what-if expensesPercent adjustment (e.g., Frugal = 90%)
  const baseExpenses = scenarioOverrides.monthlyExpenses ?? plan.monthlyExpenses
  const effectiveExpenses = Math.round(
    baseExpenses * (combinedAdjustments.expensesPercent / 100),
  )
  const effectivePension =
    scenarioOverrides.pensionMonthly ?? plan.pensionMonthly ?? 0
  const effectiveSocialSecurity =
    scenarioOverrides.socialSecurityMonthly ?? plan.socialSecurityMonthly ?? 0
  const effectiveOtherIncome =
    scenarioOverrides.otherIncomeMonthly ?? plan.otherIncomeMonthly ?? 0
  const effectiveInflation =
    scenarioOverrides.inflationRate ?? plan.inflationRate
  const effectiveTarget = scenarioOverrides.targetBalance ?? plan.targetBalance
  const effectiveEquityReturn =
    scenarioOverrides.equityReturnRate ?? plan.equityReturnRate
  const effectiveCashReturn =
    scenarioOverrides.cashReturnRate ?? plan.cashReturnRate
  const effectiveHousingReturn =
    scenarioOverrides.housingReturnRate ?? plan.housingReturnRate

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
            {t("retire.planDetails")}
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
            <InfoTooltip text={t("retire.monthlyExpenses.tooltip")}>
              <span className="text-gray-500">
                {t("retire.monthlyExpenses")}
              </span>
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
            <span className="text-gray-500">{t("retire.pension")}</span>
            <span
              className={`font-medium ${hideValues ? "text-gray-400" : ""}`}
            >
              {hideValues
                ? HIDDEN_VALUE
                : `${detailsCurrency}${Math.round(displayPension).toLocaleString()}`}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">
              {t("retire.governmentBenefits")}
            </span>
            <span
              className={`font-medium ${hideValues ? "text-gray-400" : ""}`}
            >
              {hideValues
                ? HIDDEN_VALUE
                : `${detailsCurrency}${Math.round(displaySocialSecurity).toLocaleString()}`}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">{t("retire.otherIncome")}</span>
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
            <InfoTooltip text={t("retire.netMonthlyNeed.tooltip")}>
              <span className="text-gray-500">
                {t("retire.netMonthlyNeed")}
              </span>
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
            <InfoTooltip text={t("retire.inflation.tooltip")}>
              <span className="text-gray-500">{t("retire.inflation")}</span>
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
              <InfoTooltip text={t("retire.targetBalance.tooltip")}>
                <span className="text-gray-500">
                  {t("retire.targetBalance")}
                </span>
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

      {/* Sustainable Spending */}
      {projection?.sustainableMonthlyExpense != null && (
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Sustainable Spending
          </h2>
          <div className="space-y-3">
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wide">
                Monthly Expense Budget
              </span>
              <div
                className={`text-2xl font-bold ${hideValues ? "text-gray-400" : "text-green-600"}`}
              >
                {hideValues
                  ? HIDDEN_VALUE
                  : `${detailsCurrency}${Math.round(projection.sustainableMonthlyExpense).toLocaleString()}`}
              </div>
            </div>
            {projection.sustainableTargetBalance != null && (
              <div className="text-sm text-gray-500">
                Targeting{" "}
                {hideValues
                  ? HIDDEN_VALUE
                  : `${detailsCurrency}${Math.round(projection.sustainableTargetBalance).toLocaleString()}`}{" "}
                ending balance
              </div>
            )}
            <hr />
            {projection.expenseAdjustment != null &&
              projection.expenseAdjustmentPercent != null && (
                <div
                  className={`text-sm font-medium ${
                    projection.expenseAdjustment >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {hideValues ? (
                    <span className="text-gray-400">{HIDDEN_VALUE}</span>
                  ) : projection.expenseAdjustment >= 0 ? (
                    <>
                      <i className="fas fa-arrow-up mr-1"></i>
                      Room to increase +{detailsCurrency}
                      {Math.round(
                        projection.expenseAdjustment,
                      ).toLocaleString()}
                      /mo (+
                      {projection.expenseAdjustmentPercent.toFixed(1)}
                      %)
                    </>
                  ) : (
                    <>
                      <i className="fas fa-arrow-down mr-1"></i>
                      Need to reduce {detailsCurrency}
                      {Math.round(
                        projection.expenseAdjustment,
                      ).toLocaleString()}
                      /mo ({projection.expenseAdjustmentPercent.toFixed(1)}
                      %)
                    </>
                  )}
                </div>
              )}
            {/* With-liquidation figure */}
            {projection.sustainableWithLiquidation != null &&
              projection.sustainableWithLiquidation !==
                projection.sustainableMonthlyExpense && (
                <>
                  <hr />
                  <div>
                    <span className="text-xs text-gray-500 uppercase tracking-wide">
                      Including Asset Disposal
                    </span>
                    <div
                      className={`text-xl font-bold ${hideValues ? "text-gray-400" : "text-blue-600"}`}
                    >
                      {hideValues
                        ? HIDDEN_VALUE
                        : `${detailsCurrency}${Math.round(projection.sustainableWithLiquidation).toLocaleString()}`}
                      <span className="text-sm font-normal text-gray-500">
                        /mo
                      </span>
                    </div>
                    {projection.liquidationAge != null && (
                      <div className="text-sm text-gray-500">
                        Property disposal from age {projection.liquidationAge}
                      </div>
                    )}
                    {projection.adjustmentWithLiquidation != null &&
                      projection.adjustmentPercentWithLiquidation != null && (
                        <div
                          className={`text-sm font-medium ${
                            projection.adjustmentWithLiquidation >= 0
                              ? "text-blue-600"
                              : "text-red-600"
                          }`}
                        >
                          {!hideValues &&
                            (projection.adjustmentWithLiquidation >= 0 ? (
                              <>
                                +{detailsCurrency}
                                {Math.round(
                                  projection.adjustmentWithLiquidation,
                                ).toLocaleString()}
                                /mo (+
                                {projection.adjustmentPercentWithLiquidation.toFixed(
                                  1,
                                )}
                                %)
                              </>
                            ) : (
                              <>
                                {detailsCurrency}
                                {Math.round(
                                  projection.adjustmentWithLiquidation,
                                ).toLocaleString()}
                                /mo (
                                {projection.adjustmentPercentWithLiquidation.toFixed(
                                  1,
                                )}
                                %)
                              </>
                            ))}
                        </div>
                      )}
                  </div>
                </>
              )}
          </div>
        </div>
      )}
      {/* Income Reducing Your FI Target */}
      {projection?.fiMetrics && projection.fiMetrics.totalMonthlyIncome > 0 && (
        <div className="col-span-1 lg:col-span-2 bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            <i className="fas fa-coins text-green-500 mr-2"></i>
            Income Reducing Your FI Target
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Your FI Number is based on <strong>net</strong> expenses - what you
            need from investments after accounting for other income sources.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500 mb-1">
                Monthly Income Sources
              </div>
              <div className="text-xl font-bold text-green-600">
                {hideValues ? (
                  HIDDEN_VALUE
                ) : (
                  <>
                    {effectiveCurrency}
                    {Math.round(
                      projection.fiMetrics.totalMonthlyIncome,
                    ).toLocaleString()}
                    /mo
                  </>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Pension + Benefits + Rental + Other
              </div>
            </div>
            <div className="p-4 bg-independence-50 rounded-lg">
              <div className="text-sm text-gray-500 mb-1">
                Net Monthly Need from Investments
              </div>
              <div className="text-xl font-bold text-independence-600">
                {hideValues ? (
                  HIDDEN_VALUE
                ) : (
                  <>
                    {effectiveCurrency}
                    {Math.round(
                      projection.fiMetrics.netMonthlyExpenses,
                    ).toLocaleString()}
                    /mo
                  </>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                This determines your FI Number
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
