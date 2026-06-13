import React, { useMemo } from "react"
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

  // Index of the row where housing drops to 0 (property liquidated).
  // CompositeYearlyProjection lacks the propertyLiquidated flag, so we
  // detect from the housingValue transition. This is a warning event —
  // it means liquid assets were depleted and property was force-sold.
  const propertyLiquidationIndex = useMemo(() => {
    if (!projection) return null
    const rows = projection.yearlyProjections
    for (let i = 1; i < rows.length; i++) {
      if (
        (rows[i - 1].housingValue ?? 0) > 0 &&
        (rows[i].housingValue ?? 0) === 0
      ) {
        return i
      }
    }
    return null
  }, [projection])

  const hasHousingData = useMemo(
    () =>
      projection?.yearlyProjections.some((r) => (r.housingValue ?? 0) > 0) ??
      false,
    [projection],
  )

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
                  <React.Fragment key={`${row.year}-${row.planId}`}>
                    {propertyLiquidationIndex === idx && (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-1.5 px-2 bg-amber-50 border-t border-b border-amber-200 text-xs text-amber-700 font-medium"
                        >
                          <i className="fas fa-exclamation-triangle mr-1.5"></i>
                          Property sold — liquid assets depleted below threshold
                        </td>
                      </tr>
                    )}
                    <tr
                      className={`border-b border-gray-50 ${
                        isPhaseStart
                          ? "border-t-2 border-t-independence-200"
                          : ""
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
                  </React.Fragment>
                )
              },
            )}
          </tbody>
        </table>
      </div>
      {hasHousingData && (
        <p className="mt-2 text-xs text-gray-400">
          <i className="fas fa-info-circle mr-1"></i>
          Balances show liquid (spendable) assets only. Property and other
          locked assets are shown in the Wealth Journey chart.
        </p>
      )}
    </div>
  )
}
