import React, { useState } from "react"
import Link from "next/link"
import useSwr from "swr"
import { simpleFetcher } from "@utils/api/fetchHelper"
import { Currency, Transaction } from "types/beancounter"
import { RetirementPlan, RetirementProjection } from "types/independence"
import Spinner from "@components/ui/Spinner"
import { usePrivacyMode } from "@hooks/usePrivacyMode"

interface MonthlyInvestmentData {
  yearMonth: string
  totalInvested: number
  currency?: string
}

interface IndependenceMetricsProps {
  primaryPlan: RetirementPlan
  projectionData: RetirementProjection | null
  projectionLoading: boolean
  monthlyInvestmentData: MonthlyInvestmentData | undefined
  displayCurrency: Currency | null
  collapsed: boolean
  onToggle: () => void
}

export default function IndependenceMetrics({
  primaryPlan,
  projectionData,
  projectionLoading,
  monthlyInvestmentData,
  displayCurrency,
  collapsed,
  onToggle,
}: IndependenceMetricsProps): React.ReactElement {
  const { hideValues } = usePrivacyMode()
  const [showInvestmentModal, setShowInvestmentModal] = useState(false)

  // Fetch transactions only when modal is open
  const investmentTrnsUrl = showInvestmentModal
    ? "/api/trns/investments/monthly/transactions"
    : null
  const { data: investmentTrnsData } = useSwr<{ data: Transaction[] }>(
    investmentTrnsUrl,
    investmentTrnsUrl ? simpleFetcher(investmentTrnsUrl) : null,
  )

  return (
    <>
      <div className="bg-white rounded-xl shadow-md p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={onToggle}
            className="flex items-center text-lg font-semibold text-gray-900 hover:text-gray-700"
          >
            <i
              className={`fas fa-chevron-${collapsed ? "right" : "down"} text-gray-400 mr-2 w-4`}
            ></i>
            <i className="fas fa-chart-line text-white mr-2"></i>
            Independence Metrics
            {projectionLoading && (
              <span className="ml-2 inline-flex items-center">
                <Spinner label="Calculating..." />
              </span>
            )}
          </button>
          <Link
            href={`/independence/plans/${primaryPlan.id}`}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            View Plan →
          </Link>
        </div>

        {!collapsed && (
          <div
            className={`grid grid-cols-1 ${projectionData ? "sm:grid-cols-2 lg:grid-cols-4" : ""} gap-4`}
          >
            {/* Monthly Investment Progress */}
            <div className="bg-linear-to-br from-blue-50 to-indigo-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Monthly Investment</p>
              {(() => {
                // Monthly investment target = surplus × allocation %
                // Surplus = working income - working expenses
                const surplus =
                  (primaryPlan.workingIncomeMonthly ?? 0) -
                  (primaryPlan.workingExpensesMonthly ?? 0)
                const target = Math.round(
                  surplus *
                    (primaryPlan.investmentAllocationPercent ?? 0.8),
                )
                const actual = Math.round(
                  monthlyInvestmentData?.totalInvested ?? 0,
                )
                const progress = target > 0 ? (actual / target) * 100 : 0
                const currencySymbol = displayCurrency?.symbol || ""
                const isNegative = actual < 0
                return (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        !hideValues && setShowInvestmentModal(true)
                      }
                      className={`flex items-baseline gap-2 ${!hideValues ? "cursor-pointer hover:opacity-80" : ""}`}
                      disabled={hideValues}
                    >
                      {hideValues ? (
                        <span className="text-3xl font-bold text-gray-400">
                          ****
                        </span>
                      ) : (
                        <>
                          <span
                            className={`text-3xl font-bold ${isNegative ? "text-red-600" : progress >= 100 ? "text-green-600" : "text-blue-600"}`}
                          >
                            {isNegative ? "-" : ""}
                            {currencySymbol}
                            {Math.abs(actual).toLocaleString()}
                          </span>
                          <span className="text-sm text-gray-500">
                            / {currencySymbol}
                            {target.toLocaleString()}
                          </span>
                          <i className="fas fa-external-link-alt text-xs text-gray-400 ml-1"></i>
                        </>
                      )}
                    </button>
                    <div className="mt-2 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${isNegative ? "bg-red-500" : progress >= 100 ? "bg-green-500" : "bg-blue-500"}`}
                        style={{
                          width: `${Math.min(Math.max(progress, 0), 100)}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {isNegative
                        ? "Net withdrawal this month"
                        : progress >= 100
                          ? "Target met!"
                          : `${progress.toFixed(0)}% of monthly target`}
                    </p>
                  </>
                )
              })()}
            </div>

            {/* FI Progress - show loading skeleton or data */}
            {(projectionLoading || projectionData) && (
              <div className="bg-linear-to-br from-green-50 to-emerald-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">FI Progress</p>
                {projectionLoading && !projectionData ? (
                  <>
                    <div className="h-9 w-20 bg-gray-200 rounded animate-pulse"></div>
                    <div className="mt-2 bg-gray-200 rounded-full h-2">
                      <div className="bg-gray-300 h-2 rounded-full w-0"></div>
                    </div>
                    <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mt-2"></div>
                  </>
                ) : (
                  <>
                    <div className="flex items-baseline gap-2">
                      {hideValues ? (
                        <span className="text-3xl font-bold text-gray-400">
                          ****
                        </span>
                      ) : (
                        <span className="text-3xl font-bold text-green-600">
                          {projectionData?.fiMetrics?.fiProgress?.toFixed(
                            1,
                          ) ?? "0"}
                          %
                        </span>
                      )}
                    </div>
                    <div className="mt-2 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{
                          width: hideValues
                            ? "0%"
                            : `${Math.min(projectionData?.fiMetrics?.fiProgress ?? 0, 100)}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {hideValues
                        ? ""
                        : projectionData?.fiMetrics
                              ?.isFinanciallyIndependent
                          ? "Financially Independent!"
                          : "Progress toward FI Number"}
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Years to FI */}
            {(projectionLoading || projectionData) && (
              <div className="bg-linear-to-br from-orange-50 to-amber-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Years to FI</p>
                {projectionLoading && !projectionData ? (
                  <>
                    <div className="h-9 w-16 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-4 w-36 bg-gray-200 rounded animate-pulse mt-2"></div>
                  </>
                ) : (
                  <>
                    <div className="flex items-baseline gap-2">
                      {hideValues ? (
                        <span className="text-3xl font-bold text-gray-400">
                          ****
                        </span>
                      ) : projectionData?.fiMetrics
                          ?.isFinanciallyIndependent ? (
                        <span className="text-2xl font-bold text-green-600">
                          FI Achieved!
                        </span>
                      ) : projectionData?.fiMetrics?.realYearsToFi !=
                        null ? (
                        <>
                          <span className="text-3xl font-bold text-orange-600">
                            {Math.round(
                              projectionData.fiMetrics.realYearsToFi,
                            )}
                          </span>
                          <span className="text-sm text-gray-500">
                            years
                          </span>
                        </>
                      ) : (
                        <span className="text-2xl font-bold text-gray-400">
                          —
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {hideValues
                        ? ""
                        : projectionData?.fiMetrics
                              ?.isFinanciallyIndependent
                          ? "You've reached financial independence!"
                          : projectionData?.fiAchievementAge
                            ? `FI at age ${projectionData.fiAchievementAge}`
                            : "Keep investing to reach FIRE"}
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Property Liquidation Age */}
            {(projectionLoading || projectionData) && (
              <div className="bg-linear-to-br from-purple-50 to-violet-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">
                  <i className="fas fa-home text-white mr-1"></i>
                  Property Sale Age
                </p>
                {projectionLoading && !projectionData ? (
                  <>
                    <div className="h-9 w-24 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mt-2"></div>
                  </>
                ) : (
                  (() => {
                    const liquidationYear =
                      projectionData?.yearlyProjections?.find(
                        (y) => y.propertyLiquidated,
                      )
                    const hasProperty =
                      (projectionData?.nonSpendableAtRetirement ?? 0) > 0
                    return (
                      <>
                        <div className="flex items-baseline gap-2">
                          {hideValues ? (
                            <span className="text-3xl font-bold text-gray-400">
                              ****
                            </span>
                          ) : liquidationYear?.age ? (
                            <>
                              <span className="text-3xl font-bold text-purple-600">
                                {liquidationYear.age}
                              </span>
                              <span className="text-sm text-gray-500">
                                years old
                              </span>
                            </>
                          ) : hasProperty ? (
                            <span className="text-2xl font-bold text-green-600">
                              Not needed
                            </span>
                          ) : (
                            <span className="text-2xl font-bold text-gray-400">
                              N/A
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          {hideValues
                            ? ""
                            : liquidationYear?.age
                              ? "When liquid assets run low"
                              : hasProperty
                                ? "Liquid assets sufficient"
                                : "No illiquid assets"}
                        </p>
                      </>
                    )
                  })()
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Monthly Investment Transactions Modal */}
      {showInvestmentModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black/50 transition-opacity"
            onClick={() => setShowInvestmentModal(false)}
          />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Monthly Investment Transactions
                  </h3>
                  <p className="text-sm text-gray-500">
                    {monthlyInvestmentData?.yearMonth || "Current month"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInvestmentModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-2"
                >
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>

              {/* Content */}
              <div className="px-6 py-4 overflow-y-auto max-h-[60vh]">
                {!investmentTrnsData ? (
                  <div className="flex justify-center py-8">
                    <Spinner size="lg" />
                  </div>
                ) : investmentTrnsData.data.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    No investment transactions this month
                  </p>
                ) : (
                  <table className="min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Date
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Type
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Asset
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {investmentTrnsData.data.map((trn) => (
                        <tr key={trn.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-sm text-gray-600">
                            {trn.tradeDate}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${
                                trn.trnType === "BUY"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {trn.trnType}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900">
                            {trn.asset?.code || trn.asset?.name || "Unknown"}
                          </td>
                          <td
                            className={`px-3 py-2 text-sm text-right font-medium ${
                              trn.trnType === "BUY"
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {trn.trnType === "SELL" ? "-" : ""}
                            {trn.tradeCurrency?.symbol}
                            {Math.abs(trn.tradeAmount).toLocaleString(
                              undefined,
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              },
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                      <tr>
                        <td
                          colSpan={3}
                          className="px-3 py-2 text-sm font-semibold text-gray-900"
                        >
                          Net Total ({displayCurrency?.code})
                        </td>
                        <td
                          className={`px-3 py-2 text-sm text-right font-bold ${
                            (monthlyInvestmentData?.totalInvested ?? 0) >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {(monthlyInvestmentData?.totalInvested ?? 0) < 0
                            ? "-"
                            : ""}
                          {displayCurrency?.symbol}
                          {Math.abs(
                            monthlyInvestmentData?.totalInvested ?? 0,
                          ).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
                Shows BUY and SELL transactions only. ADD/transfers are
                excluded.
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
