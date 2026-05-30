import React from "react"
import { RetirementProjection } from "types/independence"
import { HIDDEN_VALUE } from "@lib/independence/planHelpers"
import { usePrivacyMode } from "@hooks/usePrivacyMode"

interface SustainableSpendingCardProps {
  projection: RetirementProjection | null
  /**
   * Currency symbol/code prefix to use for monetary values. Pass the plan's
   * display currency (which may be the user's chosen display currency, not
   * necessarily the plan currency).
   */
  currency: string
}

/**
 * Sustainable Spending card — monthly expense budget the projection can
 * support, optional with-liquidation figure, and expense-adjustment hint.
 * Lives in the Metrics tab so users analysing strategies can see how their
 * choices affect spending capacity.
 */
export default function SustainableSpendingCard({
  projection,
  currency,
}: SustainableSpendingCardProps): React.ReactElement | null {
  const { hideValues } = usePrivacyMode()

  if (projection?.sustainableMonthlyExpense == null) {
    return null
  }

  return (
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
              : `${currency}${Math.round(projection.sustainableMonthlyExpense).toLocaleString()}`}
          </div>
        </div>
        {projection.sustainableTargetBalance != null &&
          projection.sustainableTargetBalance > 0 && (
            <div className="text-sm text-gray-500">
              Targeting{" "}
              {hideValues
                ? HIDDEN_VALUE
                : `${currency}${Math.round(projection.sustainableTargetBalance).toLocaleString()}`}{" "}
              ending balance
            </div>
          )}
        <div className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">
          Assumes steady returns with no market volatility. Use Stress Test for
          a range of outcomes.
        </div>
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
                  Room to increase +{currency}
                  {Math.round(projection.expenseAdjustment).toLocaleString()}
                  /mo (+
                  {projection.expenseAdjustmentPercent.toFixed(1)}
                  %)
                </>
              ) : (
                <>
                  <i className="fas fa-arrow-down mr-1"></i>
                  Need to reduce {currency}
                  {Math.round(projection.expenseAdjustment).toLocaleString()}
                  /mo ({projection.expenseAdjustmentPercent.toFixed(1)}
                  %)
                </>
              )}
            </div>
          )}
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
                    : `${currency}${Math.round(projection.sustainableWithLiquidation).toLocaleString()}`}
                  <span className="text-sm font-normal text-gray-500">/mo</span>
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
                            +{currency}
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
                            {currency}
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
  )
}
