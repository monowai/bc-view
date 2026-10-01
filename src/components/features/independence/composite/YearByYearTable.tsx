import React, { useMemo, useState } from "react"
import type { CompositeYearlyProjection } from "types/independence"
import { usePrivacyMode } from "@hooks/usePrivacyMode"
import { useCompositeProjectionContext } from "./CompositeProjectionContext"
import YearFlowDialog from "../YearFlowDialog"

const HIDDEN_VALUE = "****"

function formatMoney(value: number, currency: string, hide: boolean): string {
  if (hide) return HIDDEN_VALUE
  return `${currency} ${Math.round(value).toLocaleString()}`
}

/**
 * The ledger behind the chart, one row per year.
 *
 * This was a tab of its own, which put a 40-row table at the same level of
 * prominence as the question "will my money last" — it is the evidence for
 * that answer, not a peer of it. It now lives in a disclosure under the
 * chart, closed by default.
 *
 * Each age opens that year's sources-and-uses drill-down, labelled with the
 * stage the year falls in.
 */
export default function YearByYearTable(): React.ReactElement | null {
  const { hideValues } = usePrivacyMode()
  const { displayCurrency, projection } = useCompositeProjectionContext()
  const [selected, setSelected] = useState<CompositeYearlyProjection | null>(
    null,
  )

  // Index of the row where housing drops to 0 (property liquidated).
  // CompositeYearlyProjection lacks the propertyLiquidated flag, so we detect
  // from the housingValue transition. This is a warning event — it means
  // liquid assets were depleted and property was force-sold.
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

  if (!projection) return null

  return (
    <>
      <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
        Choose an age to see where that year&rsquo;s money comes from and goes.
      </p>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <caption className="sr-only">
            Year by year: starting balance, income, expenses and ending balance
            for each age in the plan.
          </caption>
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400">
              <th scope="col" className="px-2 py-2">
                Age
              </th>
              <th scope="col" className="px-2 py-2">
                Stage
              </th>
              <th scope="col" className="px-2 py-2 text-right">
                Starting
              </th>
              <th scope="col" className="px-2 py-2 text-right">
                Income
              </th>
              <th scope="col" className="px-2 py-2 text-right">
                Spending
              </th>
              <th scope="col" className="px-2 py-2 text-right">
                Ending
              </th>
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
                          className="border-b border-t border-amber-200 bg-amber-50 px-2 py-1.5 text-xs font-medium text-amber-900"
                        >
                          <i
                            aria-hidden="true"
                            className="fas fa-exclamation-triangle mr-1.5"
                          />
                          Property sold — savings had run too low to keep
                          spending from them
                        </td>
                      </tr>
                    )}
                    <tr
                      className={`border-b border-gray-50 dark:border-gray-800 ${
                        isPhaseStart
                          ? "border-t-2 border-t-independence-200"
                          : ""
                      } ${row.endingBalance <= 0 ? "bg-red-50 dark:bg-red-950" : ""}`}
                    >
                      <td className="px-2 py-1.5 tabular-nums text-gray-600 dark:text-gray-400">
                        <button
                          type="button"
                          onClick={() => setSelected(row)}
                          aria-label={`Show where the money goes at age ${row.age}`}
                          className="rounded px-1 text-independence-700 underline decoration-dotted underline-offset-2 hover:bg-independence-50 dark:text-independence-300 dark:hover:bg-gray-800"
                        >
                          {row.age}
                        </button>
                      </td>
                      <td className="px-2 py-1.5 text-gray-700 dark:text-gray-300">
                        {isPhaseStart ? (
                          <span className="font-medium">{row.planName}</span>
                        ) : (
                          <span className="text-gray-400">&mdash;</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {formatMoney(
                          row.startingBalance,
                          displayCurrency,
                          hideValues,
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-green-700 dark:text-green-400">
                        {formatMoney(row.income, displayCurrency, hideValues)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-red-600 dark:text-red-400">
                        {formatMoney(row.expenses, displayCurrency, hideValues)}
                      </td>
                      <td
                        className={`px-2 py-1.5 text-right font-medium tabular-nums ${
                          row.endingBalance <= 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-gray-800 dark:text-gray-200"
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
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          These balances are money you can spend. Property and other tied-up
          assets show under &ldquo;What it&rsquo;s made of&rdquo; on the chart.
        </p>
      )}
      {selected && (
        <YearFlowDialog
          age={selected.age}
          stage={selected.planName}
          currency={displayCurrency}
          row={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}
