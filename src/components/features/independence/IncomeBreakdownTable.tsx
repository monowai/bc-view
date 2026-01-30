import React, { useState, useMemo } from "react"
import { YearlyProjection } from "types/independence"
import { usePrivacyMode } from "@hooks/usePrivacyMode"

const HIDDEN_VALUE = "****"

interface IncomeBreakdownTableProps {
  projections: YearlyProjection[]
  embedded?: boolean
}

export default function IncomeBreakdownTable({
  projections,
  embedded = false,
}: IncomeBreakdownTableProps): React.ReactElement {
  const [isExpanded, setIsExpanded] = useState(false)
  const { hideValues } = usePrivacyMode()

  // Determine which columns have data across all projections
  const columnVisibility = useMemo(() => {
    const hasData = {
      investment: false,
      pension: false,
      assetPensions: false,
      lumpSum: false,
      socialSecurity: false,
      otherIncome: false,
      rentalIncome: false,
    }

    for (const projection of projections) {
      const breakdown = projection.incomeBreakdown
      if (!breakdown) continue

      if (breakdown.investmentReturns > 0) hasData.investment = true
      if (breakdown.pension > 0) hasData.pension = true
      if ((breakdown.assetPensions ?? 0) > 0) hasData.assetPensions = true
      if ((breakdown.lumpSumPayout ?? 0) > 0) hasData.lumpSum = true
      if (breakdown.socialSecurity > 0) hasData.socialSecurity = true
      if (breakdown.otherIncome > 0) hasData.otherIncome = true
      if (breakdown.rentalIncome > 0) hasData.rentalIncome = true
    }

    return hasData
  }, [projections])

  // Count visible income columns for colSpan calculation
  const visibleIncomeColumns =
    1 + // Age (always visible)
    (columnVisibility.investment ? 1 : 0) +
    (columnVisibility.pension ? 1 : 0) +
    (columnVisibility.assetPensions ? 1 : 0) +
    (columnVisibility.lumpSum ? 1 : 0) +
    (columnVisibility.socialSecurity ? 1 : 0) +
    (columnVisibility.otherIncome ? 1 : 0) +
    (columnVisibility.rentalIncome ? 1 : 0) +
    4 // Total Income, Expenses, Withdrawals, End Balance (always visible)

  const formatCurrency = (value: number): string => {
    if (hideValues) return HIDDEN_VALUE
    if (value === 0) return "-"
    return `$${Math.round(value).toLocaleString()}`
  }

  if (!projections || projections.length === 0) {
    return <></>
  }

  // Only show first few and last few years when collapsed
  const displayProjections = isExpanded
    ? projections
    : [
        ...projections.slice(0, 3),
        ...(projections.length > 6 ? [null] : []), // null represents "..." row
        ...projections.slice(-3),
      ].filter(
        (p, i, arr) =>
          p !== null || (i > 0 && arr[i - 1] !== null && i < arr.length - 1),
      )

  const expandButton = (
    <button
      onClick={() => setIsExpanded(!isExpanded)}
      className="text-sm text-blue-600 hover:text-blue-700"
    >
      {isExpanded ? (
        <>
          <i className="fas fa-compress-alt mr-1"></i>
          Collapse
        </>
      ) : (
        <>
          <i className="fas fa-expand-alt mr-1"></i>
          Expand All ({projections.length} years)
        </>
      )}
    </button>
  )

  const tableContent = (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-2 font-medium text-gray-600 border-r border-gray-200">
                Age
              </th>
              {columnVisibility.investment && (
                <th className="text-right py-2 px-2 font-medium text-gray-600">
                  <span className="text-green-600">Investment</span>
                </th>
              )}
              {columnVisibility.pension && (
                <th className="text-right py-2 px-2 font-medium text-gray-600">
                  <span className="text-blue-600">Pension</span>
                </th>
              )}
              {columnVisibility.assetPensions && (
                <th className="text-right py-2 px-2 font-medium text-gray-600">
                  <span className="text-indigo-600">Private Pension</span>
                </th>
              )}
              {columnVisibility.lumpSum && (
                <th className="text-right py-2 px-2 font-medium text-gray-600">
                  <span className="text-pink-600">Lump Sum</span>
                </th>
              )}
              {columnVisibility.socialSecurity && (
                <th className="text-right py-2 px-2 font-medium text-gray-600">
                  <span className="text-purple-600">Govt Benefits</span>
                </th>
              )}
              {columnVisibility.otherIncome && (
                <th className="text-right py-2 px-2 font-medium text-gray-600">
                  <span className="text-orange-600">Other</span>
                </th>
              )}
              {columnVisibility.rentalIncome && (
                <th className="text-right py-2 px-2 font-medium text-gray-600">
                  <span className="text-teal-600">Rental</span>
                </th>
              )}
              <th className="text-right py-2 px-2 font-medium text-gray-700 border-l border-gray-200">
                Total Income
              </th>
              <th className="text-right py-2 px-2 font-medium text-gray-600">
                Expenses
              </th>
              <th className="text-right py-2 px-2 font-medium text-red-600">
                Withdrawals
              </th>
              <th className="text-right py-2 px-2 font-medium text-gray-700 border-l border-gray-200">
                End Balance
              </th>
            </tr>
          </thead>
          <tbody>
            {displayProjections.map((projection, index) => {
              if (projection === null) {
                return (
                  <tr key={`gap-${index}`} className="border-b border-gray-100">
                    <td
                      colSpan={visibleIncomeColumns}
                      className="text-center py-2 text-gray-400 italic"
                    >
                      ...
                    </td>
                  </tr>
                )
              }

              const breakdown = projection.incomeBreakdown
              const isNegativeBalance = projection.endingBalance <= 0
              const hasPropertyLiquidation = projection.propertyLiquidated
              const hasLumpSum = (breakdown?.lumpSumPayout ?? 0) > 0

              return (
                <tr
                  key={projection.year}
                  className={`border-b border-gray-100 hover:bg-gray-50 ${
                    isNegativeBalance ? "bg-red-50" : ""
                  } ${hasPropertyLiquidation ? "bg-purple-50" : ""} ${hasLumpSum ? "bg-pink-50" : ""}`}
                >
                  <td className="py-2 px-2 font-medium border-r border-gray-200">
                    {projection.age}
                    {hasPropertyLiquidation && (
                      <i
                        className="fas fa-home text-purple-500 ml-1"
                        title="Property liquidated"
                      ></i>
                    )}
                    {hasLumpSum && (
                      <i
                        className="fas fa-gift text-pink-500 ml-1"
                        title="Lump sum payout received"
                      ></i>
                    )}
                  </td>
                  {columnVisibility.investment && (
                    <td className="text-right py-2 px-2 text-green-600">
                      {breakdown
                        ? formatCurrency(breakdown.investmentReturns)
                        : "-"}
                    </td>
                  )}
                  {columnVisibility.pension && (
                    <td className="text-right py-2 px-2 text-blue-600">
                      {breakdown ? formatCurrency(breakdown.pension) : "-"}
                    </td>
                  )}
                  {columnVisibility.assetPensions && (
                    <td className="text-right py-2 px-2 text-indigo-600">
                      {breakdown?.assetPensions
                        ? formatCurrency(breakdown.assetPensions)
                        : "-"}
                    </td>
                  )}
                  {columnVisibility.lumpSum && (
                    <td className="text-right py-2 px-2 text-pink-600 font-medium">
                      {breakdown?.lumpSumPayout
                        ? formatCurrency(breakdown.lumpSumPayout)
                        : "-"}
                    </td>
                  )}
                  {columnVisibility.socialSecurity && (
                    <td className="text-right py-2 px-2 text-purple-600">
                      {breakdown
                        ? formatCurrency(breakdown.socialSecurity)
                        : "-"}
                    </td>
                  )}
                  {columnVisibility.otherIncome && (
                    <td className="text-right py-2 px-2 text-orange-600">
                      {breakdown ? formatCurrency(breakdown.otherIncome) : "-"}
                    </td>
                  )}
                  {columnVisibility.rentalIncome && (
                    <td className="text-right py-2 px-2 text-teal-600">
                      {breakdown ? formatCurrency(breakdown.rentalIncome) : "-"}
                    </td>
                  )}
                  <td className="text-right py-2 px-2 font-medium border-l border-gray-200">
                    {breakdown ? formatCurrency(breakdown.totalIncome) : "-"}
                  </td>
                  <td className="text-right py-2 px-2 text-gray-600">
                    {formatCurrency(projection.inflationAdjustedExpenses)}
                  </td>
                  <td className="text-right py-2 px-2 text-red-600">
                    {projection.withdrawals > 0
                      ? formatCurrency(projection.withdrawals)
                      : "-"}
                  </td>
                  <td
                    className={`text-right py-2 px-2 font-medium border-l border-gray-200 ${
                      isNegativeBalance ? "text-red-600" : "text-gray-900"
                    }`}
                  >
                    {formatCurrency(projection.endingBalance)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-xs text-gray-500">
        <p className="flex flex-wrap gap-x-3">
          {columnVisibility.investment && (
            <span>
              <span className="font-medium text-green-600">Investment:</span>{" "}
              Returns on portfolio
            </span>
          )}
          {columnVisibility.pension && (
            <span>
              <span className="font-medium text-blue-600">Pension:</span>{" "}
              Employer pension
            </span>
          )}
          {columnVisibility.assetPensions && (
            <span>
              <span className="font-medium text-indigo-600">
                Private Pension:
              </span>{" "}
              From pension/insurance assets
            </span>
          )}
          {columnVisibility.lumpSum && (
            <span>
              <span className="font-medium text-pink-600">Lump Sum:</span>{" "}
              One-time policy payouts
            </span>
          )}
          {columnVisibility.socialSecurity && (
            <span>
              <span className="font-medium text-purple-600">
                Govt Benefits:
              </span>{" "}
              Inflation-indexed
            </span>
          )}
          {columnVisibility.otherIncome && (
            <span>
              <span className="font-medium text-orange-600">Other:</span> Not
              indexed
            </span>
          )}
          {columnVisibility.rentalIncome && (
            <span>
              <span className="font-medium text-teal-600">Rental:</span>{" "}
              Property income
            </span>
          )}
          <span>
            <span className="font-medium text-red-600">Withdrawals:</span> Drawn
            from portfolio
          </span>
        </p>
      </div>
    </>
  )

  if (embedded) {
    return (
      <div>
        <div className="flex justify-end mb-4">{expandButton}</div>
        {tableContent}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          <i className="fas fa-table text-blue-500 mr-2"></i>
          Income Breakdown
        </h3>
        {expandButton}
      </div>
      {tableContent}
    </div>
  )
}
