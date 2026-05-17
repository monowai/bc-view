import React from "react"
import type { CompositeYearlyProjection } from "types/independence"
import Spinner from "@components/ui/Spinner"
import Alert from "@components/ui/Alert"
import { usePrivacyMode } from "@hooks/usePrivacyMode"
import { useCompositeProjectionContext } from "../CompositeProjectionContext"

const HIDDEN_VALUE = "****"

function formatMoney(value: number, currency: string, hide: boolean): string {
  if (hide) return HIDDEN_VALUE
  return `${currency} ${Math.round(value).toLocaleString()}`
}

/**
 * Year-by-Year tab — renders the yearly timeline table from the composite
 * projection. Reads all state from {@link useCompositeProjectionContext}.
 */
export default function YearByYearTab(): React.ReactElement | null {
  const { hideValues } = usePrivacyMode()
  const { displayCurrency, projection, isLoading, error } =
    useCompositeProjectionContext()

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <Spinner label="Calculating composite projection..." size="lg" />
      </div>
    )
  }

  if (error) {
    return <Alert>{error}</Alert>
  }

  if (!projection) {
    return null
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-4">
      <h3 className="text-sm font-medium text-gray-700 mb-3">
        Year-by-Year Timeline
      </h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase">
              <th className="py-2 px-2">Age</th>
              <th className="py-2 px-2">Phase</th>
              <th className="py-2 px-2 text-right">Starting</th>
              <th className="py-2 px-2 text-right">Income</th>
              <th className="py-2 px-2 text-right">Expenses</th>
              <th className="py-2 px-2 text-right">Ending</th>
            </tr>
          </thead>
          <tbody>
            {projection.yearlyProjections.map(
              (row: CompositeYearlyProjection, idx: number) => {
                const isPhaseStart =
                  idx === 0 ||
                  row.planId !== projection.yearlyProjections[idx - 1]?.planId
                return (
                  <tr
                    key={`${row.year}-${row.planId}`}
                    className={`border-b border-gray-50 ${
                      isPhaseStart ? "border-t-2 border-t-independence-200" : ""
                    } ${row.endingBalance <= 0 ? "bg-red-50" : ""}`}
                  >
                    <td className="py-1.5 px-2 text-gray-600">{row.age}</td>
                    <td className="py-1.5 px-2 text-gray-700">
                      {isPhaseStart ? (
                        <span className="font-medium">{row.planName}</span>
                      ) : (
                        <span className="text-gray-400">&mdash;</span>
                      )}
                    </td>
                    <td className="py-1.5 px-2 text-right">
                      {formatMoney(
                        row.startingBalance,
                        displayCurrency,
                        hideValues,
                      )}
                    </td>
                    <td className="py-1.5 px-2 text-right text-green-600">
                      {formatMoney(row.income, displayCurrency, hideValues)}
                    </td>
                    <td className="py-1.5 px-2 text-right text-red-600">
                      {formatMoney(row.expenses, displayCurrency, hideValues)}
                    </td>
                    <td
                      className={`py-1.5 px-2 text-right font-medium ${
                        row.endingBalance <= 0
                          ? "text-red-600"
                          : "text-gray-800"
                      }`}
                    >
                      {formatMoney(
                        row.endingBalance,
                        displayCurrency,
                        hideValues,
                      )}
                    </td>
                  </tr>
                )
              },
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
