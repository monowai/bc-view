import React, { useState } from "react"
import Link from "next/link"
import useSwr from "swr"
import { simpleFetcher } from "@utils/api/fetchHelper"
import Dialog from "@components/ui/Dialog"
import { Currency, Transaction } from "types/beancounter"
import type { RetirementPlan, RetirementProjection } from "types/independence"
import { pickHeadlineGauge } from "@utils/independence/headlineGauge"
import WealthSection from "@components/features/wealth/WealthSection"
import Spinner from "@components/ui/Spinner"
import { usePrivacyMode } from "@hooks/usePrivacyMode"
import { investmentsMonthlyTransactionsKey } from "@utils/api/client/trns"

const METRIC_CLS = "px-4 first:pl-0 lg:last:pr-0"

interface MonthlyInvestmentData {
  startDate: string
  endDate: string
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
    ? investmentsMonthlyTransactionsKey
    : null
  const { data: investmentTrnsData } = useSwr<{ data: Transaction[] }>(
    investmentTrnsUrl,
    investmentTrnsUrl ? simpleFetcher(investmentTrnsUrl) : null,
  )

  return (
    <>
      <WealthSection
        title="Independence Metrics"
        icon="fa-chart-line"
        collapsed={collapsed}
        onToggle={onToggle}
        note={projectionLoading && <Spinner label="Calculating..." />}
        action={
          <Link
            href={`/independence/plans/${primaryPlan.id}`}
            className="shrink-0 rounded-sm text-sm text-wealth-600 hover:text-wealth-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-wealth-500"
          >
            Projections →
          </Link>
        }
      >
        <div
          className={`grid grid-cols-1 gap-y-4 ${projectionData ? "sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-gray-100" : ""}`}
        >
          {/* Monthly Investment Progress */}
          <div className={METRIC_CLS}>
            <p className="text-xs font-medium text-gray-500 mb-1">
              Monthly Investment
            </p>
            {(() => {
              // Monthly investment target = the backend-computed net
              // contribution. Prefer the projection echo (authoritative,
              // full formula); fall back to computing it from the plan with
              // the SAME formula the backend uses — surplus includes bonus
              // and is net of taxes, which the old surplus calc dropped,
              // collapsing the target to 0 whenever income ≈ expenses.
              const planContribution = Math.max(
                ((primaryPlan.workingIncomeMonthly ?? 0) +
                  (primaryPlan.bonusMonthly ?? 0) -
                  (primaryPlan.workingExpensesMonthly ?? 0) -
                  (primaryPlan.taxesMonthly ?? 0)) *
                  (primaryPlan.investmentAllocationPercent ?? 0.8),
                0,
              )
              const target = Math.round(
                projectionData?.preRetirementAccumulation
                  ?.monthlyContribution ?? planContribution,
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
                    onClick={() => !hideValues && setShowInvestmentModal(true)}
                    className={`flex items-baseline gap-2 ${!hideValues ? "cursor-pointer hover:opacity-80" : ""}`}
                    disabled={hideValues}
                  >
                    {hideValues ? (
                      <span className="text-2xl font-bold text-gray-400">
                        ****
                      </span>
                    ) : (
                      <>
                        <span
                          className={`text-2xl font-bold tabular-nums ${isNegative ? "text-loss" : progress >= 100 ? "text-gain" : "text-gray-900"}`}
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
                  <div className="mt-2 bg-gray-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${isNegative ? "bg-loss" : progress >= 100 ? "bg-gain" : "bg-independence-500"}`}
                      style={{
                        width: `${Math.min(Math.max(progress, 0), 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {isNegative
                      ? "Net withdrawal (last 30 days)"
                      : progress >= 100
                        ? "Target met!"
                        : `${progress.toFixed(0)}% of monthly target`}
                  </p>
                </>
              )
            })()}
          </div>

          {/* Headline progress — driven by the plan's effective headline
                metric. Falls back to Progress when the
                selected metric has no value. */}
          {(projectionLoading || projectionData) &&
            (() => {
              const headline = pickHeadlineGauge(
                projectionData?.effectiveHeadlineMetric,
                projectionData?.fiMetrics,
              )
              return (
                <div className={METRIC_CLS}>
                  <p className="text-xs font-medium text-gray-500 mb-1">
                    {headline.label}
                  </p>
                  {projectionLoading && !projectionData ? (
                    <>
                      <div className="h-9 w-20 bg-gray-200 rounded animate-pulse"></div>
                      <div className="mt-2 bg-gray-100 rounded-full h-1.5">
                        <div className="bg-gray-300 h-1.5 rounded-full w-0"></div>
                      </div>
                      <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mt-2"></div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-2">
                        {hideValues ? (
                          <span className="text-2xl font-bold text-gray-400">
                            ****
                          </span>
                        ) : (
                          <span className="text-2xl font-bold tabular-nums text-gray-900">
                            {headline.display}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 bg-gray-100 rounded-full h-1.5">
                        <div
                          className="bg-independence-500 h-1.5 rounded-full transition-all"
                          style={{
                            width: hideValues
                              ? "0%"
                              : `${headline.fillPercent}%`,
                          }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        {hideValues
                          ? ""
                          : projectionData?.fiMetrics?.isFinanciallyIndependent
                            ? "Financially Independent!"
                            : headline.byline}
                      </p>
                    </>
                  )}
                </div>
              )
            })()}

          {/* Years to FI */}
          {(projectionLoading || projectionData) && (
            <div className={METRIC_CLS}>
              <p className="text-xs font-medium text-gray-500 mb-1">
                Years to FI
              </p>
              {projectionLoading && !projectionData ? (
                <>
                  <div className="h-9 w-16 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 w-36 bg-gray-200 rounded animate-pulse mt-2"></div>
                </>
              ) : (
                <>
                  <div className="flex items-baseline gap-2">
                    {hideValues ? (
                      <span className="text-2xl font-bold text-gray-400">
                        ****
                      </span>
                    ) : projectionData?.fiMetrics?.isFinanciallyIndependent ? (
                      <span className="text-2xl font-bold text-gain">
                        FI Achieved!
                      </span>
                    ) : projectionData?.fiMetrics?.realYearsToFi != null ? (
                      <>
                        <span className="text-2xl font-bold tabular-nums text-gray-900">
                          {Math.round(projectionData.fiMetrics.realYearsToFi)}
                        </span>
                        <span className="text-sm text-gray-500">years</span>
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
                      : projectionData?.fiMetrics?.isFinanciallyIndependent
                        ? "You've reached financial independence!"
                        : projectionData?.fiAchievementAge
                          ? `FI at age ${projectionData.fiAchievementAge}`
                          : "Keep investing to reach FI"}
                  </p>
                </>
              )}
            </div>
          )}

          {/* Property Liquidation Age */}
          {(projectionLoading || projectionData) && (
            <div className={METRIC_CLS}>
              <p className="text-xs font-medium text-gray-500 mb-1">
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
                          <span className="text-2xl font-bold text-gray-400">
                            ****
                          </span>
                        ) : liquidationYear?.age ? (
                          <>
                            <span className="text-2xl font-bold tabular-nums text-gray-900">
                              {liquidationYear.age}
                            </span>
                            <span className="text-sm text-gray-500">
                              years old
                            </span>
                          </>
                        ) : hasProperty ? (
                          <span className="text-2xl font-bold text-gain">
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
      </WealthSection>

      {/* Monthly Investment Transactions Modal */}
      {showInvestmentModal && (
        <Dialog
          title={
            <div>
              <div>Monthly Investment Transactions</div>
              <p className="text-sm font-normal text-gray-500 mt-0.5">
                {monthlyInvestmentData?.startDate &&
                monthlyInvestmentData?.endDate
                  ? `${monthlyInvestmentData.startDate} – ${monthlyInvestmentData.endDate}`
                  : "Last 30 days"}
              </p>
            </div>
          }
          onClose={() => setShowInvestmentModal(false)}
          maxWidth="2xl"
          scrollable
          footer={
            <p className="text-xs text-gray-500 w-full">
              Shows BUY and SELL transactions only. ADD/transfers are excluded.
            </p>
          }
        >
          {!investmentTrnsData ? (
            <div className="flex justify-center py-8">
              <Spinner size="lg" />
            </div>
          ) : investmentTrnsData.data.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              No investment transactions in the last 30 days
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
                      {Math.abs(trn.tradeAmount).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
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
                    {(monthlyInvestmentData?.totalInvested ?? 0) < 0 ? "-" : ""}
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
        </Dialog>
      )}
    </>
  )
}
