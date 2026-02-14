import React from "react"
import { TrnStatus } from "types/beancounter"
import { AggregatedTransaction } from "types/proposed"
import { getToday } from "@lib/sessionStorage"
import DecimalInput from "@components/ui/DecimalInput"

interface AggregatedTransactionsTableProps {
  aggregatedTransactions: AggregatedTransaction[]
  selectedIds: Set<string>
  onSelectAggregated: (aggregateKey: string, checked: boolean) => void
  onPriceChange: (aggregateKey: string, value: number) => void
  onStatusChange: (aggregateKey: string, value: TrnStatus) => void
  onTradeDateChange: (aggregateKey: string, value: string) => void
}

function isAggregatedSelected(
  agg: AggregatedTransaction,
  selectedIds: Set<string>,
): boolean {
  const proposedIds = agg.transactions
    .filter((t) => t.status === "PROPOSED")
    .map((t) => t.id)
  return (
    proposedIds.length > 0 && proposedIds.every((id) => selectedIds.has(id))
  )
}

function isAggregatedPartiallySelected(
  agg: AggregatedTransaction,
  selectedIds: Set<string>,
): boolean {
  const proposedIds = agg.transactions
    .filter((t) => t.status === "PROPOSED")
    .map((t) => t.id)
  const selectedCount = proposedIds.filter((id) => selectedIds.has(id)).length
  return selectedCount > 0 && selectedCount < proposedIds.length
}

function hasAggregatedProposed(agg: AggregatedTransaction): boolean {
  return agg.transactions.some((t) => t.status === "PROPOSED")
}

export default function AggregatedTransactionsTable({
  aggregatedTransactions,
  selectedIds,
  onSelectAggregated,
  onPriceChange,
  onStatusChange,
  onTradeDateChange,
}: AggregatedTransactionsTableProps): React.ReactElement {
  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow">
      <table className="min-w-full divide-y divide-gray-200 text-xs">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-2 py-2 text-center font-medium text-gray-500 uppercase w-10">
              <input
                type="checkbox"
                checked={
                  aggregatedTransactions.length > 0 &&
                  aggregatedTransactions
                    .filter(hasAggregatedProposed)
                    .every((agg) => isAggregatedSelected(agg, selectedIds))
                }
                ref={(el) => {
                  if (el) {
                    const withProposed =
                      aggregatedTransactions.filter(hasAggregatedProposed)
                    const allSelected = withProposed.every((agg) =>
                      isAggregatedSelected(agg, selectedIds),
                    )
                    el.indeterminate =
                      withProposed.some((agg) =>
                        isAggregatedSelected(agg, selectedIds),
                      ) && !allSelected
                  }
                }}
                onChange={(e) => {
                  aggregatedTransactions.forEach((agg) => {
                    if (hasAggregatedProposed(agg)) {
                      onSelectAggregated(
                        agg.aggregateKey,
                        e.target.checked,
                      )
                    }
                  })
                }}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                title="Select all PROPOSED transactions"
              />
            </th>
            <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">
              Broker
            </th>
            <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">
              Type
            </th>
            <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">
              Asset
            </th>
            <th className="px-2 py-2 text-right font-medium text-gray-500 uppercase">
              Total Qty
            </th>
            <th className="px-2 py-2 text-right font-medium text-gray-500 uppercase">
              Price
            </th>
            <th className="px-2 py-2 text-right font-medium text-gray-500 uppercase">
              Total Fees
            </th>
            <th className="px-2 py-2 text-right font-medium text-gray-500 uppercase">
              Total Amount
            </th>
            <th className="px-2 py-2 text-right font-medium text-gray-500 uppercase">
              Weight
            </th>
            <th className="px-2 py-2 text-center font-medium text-gray-500 uppercase">
              Settled
            </th>
            <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">
              Date
            </th>
            <th className="px-2 py-2 text-center font-medium text-gray-500 uppercase">
              Trns
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {(() => {
            const grandTotal = aggregatedTransactions.reduce(
              (sum, a) => sum + Math.abs(a.totalAmount),
              0,
            )
            return aggregatedTransactions.map((agg) => {
              const weight =
                grandTotal > 0
                  ? (Math.abs(agg.totalAmount) / grandTotal) * 100
                  : 0
              return (
                <tr
                  key={agg.aggregateKey}
                  className={`hover:bg-gray-50 ${
                    agg.trnType === "BUY"
                      ? "bg-green-50"
                      : agg.trnType === "SELL"
                        ? "bg-red-50"
                        : ""
                  }`}
                >
                  <td className="px-2 py-1.5 whitespace-nowrap text-center">
                    <input
                      type="checkbox"
                      checked={isAggregatedSelected(agg, selectedIds)}
                      ref={(el) => {
                        if (el)
                          el.indeterminate =
                            isAggregatedPartiallySelected(agg, selectedIds)
                      }}
                      onChange={(e) =>
                        onSelectAggregated(
                          agg.aggregateKey,
                          e.target.checked,
                        )
                      }
                      disabled={!hasAggregatedProposed(agg)}
                      className="rounded border-gray-300 text-green-600 focus:ring-green-500 disabled:opacity-50"
                      title={
                        hasAggregatedProposed(agg)
                          ? `Select ${agg.transactions.filter((t) => t.status === "PROPOSED").length} transactions for bulk settle`
                          : "All transactions already settled"
                      }
                    />
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <span className="text-gray-700 font-medium">
                      {agg.brokerName || "--"}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <span
                      className={`px-1.5 py-0.5 font-medium rounded ${
                        agg.trnType === "DIVI"
                          ? "bg-blue-100 text-blue-800"
                          : agg.trnType === "BUY"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                      }`}
                    >
                      {agg.trnType}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <div className="font-medium text-gray-900">
                      {agg.assetCode}
                    </div>
                    <div className="text-xs text-gray-500 truncate max-w-32">
                      {agg.assetName}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-right font-mono font-semibold">
                    {agg.totalQuantity.toFixed(0)}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-right">
                    <DecimalInput
                      value={agg.editedPrice}
                      onChange={(v) =>
                        onPriceChange(
                          agg.aggregateKey,
                          v,
                        )
                      }
                      className="w-20 px-1 py-0.5 text-right border border-gray-300 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                      title="Editing price updates all underlying transactions"
                    />
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-right font-mono text-gray-600">
                    {agg.totalFees.toFixed(2)}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-right font-mono font-semibold">
                    {agg.totalAmount.toFixed(2)}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-right font-mono text-gray-600">
                    {weight.toFixed(1)}%
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-center">
                    <input
                      type="checkbox"
                      checked={(agg.editedStatus || "PROPOSED") === "SETTLED"}
                      onChange={(e) =>
                        onStatusChange(
                          agg.aggregateKey,
                          e.target.checked ? "SETTLED" : "PROPOSED",
                        )
                      }
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      title="Changing status updates all underlying transactions"
                    />
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <input
                      type="date"
                      value={agg.editedTradeDate || getToday()}
                      onChange={(e) =>
                        onTradeDateChange(
                          agg.aggregateKey,
                          e.target.value,
                        )
                      }
                      className="px-1 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      title="Changing date updates all underlying transactions"
                    />
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-center">
                    <span
                      className="inline-flex items-center justify-center w-6 h-6 text-xs font-medium bg-gray-200 text-gray-700 rounded-full"
                      title={`${agg.transactionIds.length} underlying transactions`}
                    >
                      {agg.transactionIds.length}
                    </span>
                  </td>
                </tr>
              )
            })
          })()}
        </tbody>
      </table>
    </div>
  )
}
