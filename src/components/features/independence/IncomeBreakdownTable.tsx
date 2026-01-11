import React, { useState } from "react"
import { YearlyProjection } from "types/independence"
import { usePrivacyMode } from "@hooks/usePrivacyMode"

const HIDDEN_VALUE = "****"

interface IncomeBreakdownTableProps {
  projections: YearlyProjection[]
}

export default function IncomeBreakdownTable({
  projections,
}: IncomeBreakdownTableProps): React.ReactElement {
  const [isExpanded, setIsExpanded] = useState(false)
  const { hideValues } = usePrivacyMode()

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

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          <i className="fas fa-table text-blue-500 mr-2"></i>
          Income Breakdown
        </h3>
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
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-2 font-medium text-gray-600">
                Age
              </th>
              <th className="text-right py-2 px-2 font-medium text-gray-600">
                <span className="text-green-600">Investment</span>
              </th>
              <th className="text-right py-2 px-2 font-medium text-gray-600">
                <span className="text-blue-600">Pension</span>
              </th>
              <th className="text-right py-2 px-2 font-medium text-gray-600">
                <span className="text-purple-600">Govt Benefits</span>
              </th>
              <th className="text-right py-2 px-2 font-medium text-gray-600">
                <span className="text-orange-600">Other</span>
              </th>
              <th className="text-right py-2 px-2 font-medium text-gray-600">
                <span className="text-teal-600">Rental</span>
              </th>
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
                      colSpan={10}
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

              return (
                <tr
                  key={projection.year}
                  className={`border-b border-gray-100 hover:bg-gray-50 ${
                    isNegativeBalance ? "bg-red-50" : ""
                  } ${hasPropertyLiquidation ? "bg-purple-50" : ""}`}
                >
                  <td className="py-2 px-2 font-medium">
                    {projection.age}
                    {hasPropertyLiquidation && (
                      <i
                        className="fas fa-home text-purple-500 ml-1"
                        title="Property liquidated"
                      ></i>
                    )}
                  </td>
                  <td className="text-right py-2 px-2 text-green-600">
                    {breakdown
                      ? formatCurrency(breakdown.investmentReturns)
                      : "-"}
                  </td>
                  <td className="text-right py-2 px-2 text-blue-600">
                    {breakdown ? formatCurrency(breakdown.pension) : "-"}
                  </td>
                  <td className="text-right py-2 px-2 text-purple-600">
                    {breakdown ? formatCurrency(breakdown.socialSecurity) : "-"}
                  </td>
                  <td className="text-right py-2 px-2 text-orange-600">
                    {breakdown ? formatCurrency(breakdown.otherIncome) : "-"}
                  </td>
                  <td className="text-right py-2 px-2 text-teal-600">
                    {breakdown ? formatCurrency(breakdown.rentalIncome) : "-"}
                  </td>
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

      <div className="mt-4 text-xs text-gray-500 space-y-1">
        <p>
          <span className="font-medium">Investment:</span> Returns on portfolio
          balance |{" "}
          <span className="font-medium text-purple-600">Govt Benefits:</span>{" "}
          Inflation-indexed | <span className="font-medium">Other:</span> Not
          indexed
        </p>
        <p>
          <span className="font-medium">Withdrawals:</span> Amount drawn from
          portfolio when expenses exceed income
        </p>
      </div>
    </div>
  )
}
