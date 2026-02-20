import React from "react"
import { Broker, TrnStatus } from "types/beancounter"
import { ProposedTransaction } from "types/proposed"
import { calculateTradeAmount } from "@utils/trns/tradeUtils"
import { stripOwnerPrefix } from "@lib/assets/assetUtils"
import DecimalInput from "@components/ui/DecimalInput"

interface DetailedTransactionsTableProps {
  transactions: ProposedTransaction[]
  brokers: Broker[]
  selectedIds: Set<string>
  allProposedSelected: boolean
  someProposedSelected: boolean
  onSelectAll: () => void
  onSelectOne: (id: string, checked: boolean) => void
  onPriceChange: (id: string, value: number) => void
  onFeesChange: (id: string, value: number) => void
  onStatusChange: (id: string, value: TrnStatus) => void
  onTradeDateChange: (id: string, value: string) => void
  onBrokerChange: (id: string, value: string) => void
  onEdit: (portfolioId: string, trnId: string) => void
  onDelete: (id: string) => void
}

export default function DetailedTransactionsTable({
  transactions,
  brokers,
  selectedIds,
  allProposedSelected,
  someProposedSelected,
  onSelectAll,
  onSelectOne,
  onPriceChange,
  onFeesChange,
  onStatusChange,
  onTradeDateChange,
  onBrokerChange,
  onEdit,
  onDelete,
}: DetailedTransactionsTableProps): React.ReactElement {
  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow">
      <table className="min-w-full divide-y divide-gray-200 text-xs">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-2 py-2 text-center font-medium text-gray-500 uppercase w-10">
              <input
                type="checkbox"
                checked={allProposedSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someProposedSelected
                }}
                onChange={onSelectAll}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                title="Select all PROPOSED transactions"
              />
            </th>
            <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">
              Broker
            </th>
            <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">
              Portfolio
            </th>
            <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">
              Type
            </th>
            <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">
              Asset
            </th>
            <th className="px-2 py-2 text-right font-medium text-gray-500 uppercase">
              Qty
            </th>
            <th className="px-2 py-2 text-right font-medium text-gray-500 uppercase">
              Price
            </th>
            <th className="px-2 py-2 text-right font-medium text-gray-500 uppercase">
              Fees
            </th>
            <th className="px-2 py-2 text-right font-medium text-gray-500 uppercase">
              Amount
            </th>
            <th className="px-2 py-2 text-center font-medium text-gray-500 uppercase">
              Settled
            </th>
            <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">
              Date
            </th>
            <th className="px-2 py-2 text-center font-medium text-gray-500 uppercase">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {transactions.map((trn) => (
            <tr key={trn.id} className="hover:bg-gray-50">
              <td className="px-2 py-1.5 whitespace-nowrap text-center">
                <input
                  type="checkbox"
                  checked={selectedIds.has(trn.id)}
                  onChange={(e) => onSelectOne(trn.id, e.target.checked)}
                  disabled={trn.status !== "PROPOSED"}
                  className="rounded border-gray-300 text-green-600 focus:ring-green-500 disabled:opacity-50"
                  title={
                    trn.status === "PROPOSED"
                      ? "Select for bulk settle"
                      : "Already settled"
                  }
                />
              </td>
              <td className="px-2 py-1.5 whitespace-nowrap">
                <select
                  value={trn.editedBrokerId || ""}
                  onChange={(e) => onBrokerChange(trn.id, e.target.value)}
                  className="px-1 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-25"
                >
                  <option value="">--</option>
                  {brokers.map((broker) => (
                    <option key={broker.id} value={broker.id}>
                      {broker.name}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-2 py-1.5 whitespace-nowrap">
                <span className="text-gray-600">{trn.portfolio.code}</span>
              </td>
              <td className="px-2 py-1.5 whitespace-nowrap">
                <span
                  className={`px-1.5 py-0.5 font-medium rounded ${
                    trn.trnType === "DIVI"
                      ? "bg-blue-100 text-blue-800"
                      : trn.trnType === "BUY"
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                  }`}
                >
                  {trn.trnType}
                </span>
              </td>
              <td className="px-2 py-1.5 whitespace-nowrap">
                <div className="font-medium text-gray-900">
                  {stripOwnerPrefix(trn.asset.code)}
                </div>
              </td>
              <td className="px-2 py-1.5 whitespace-nowrap text-right font-mono">
                {trn.quantity.toFixed(0)}
              </td>
              <td className="px-2 py-1.5 whitespace-nowrap text-right">
                <DecimalInput
                  value={trn.editedPrice}
                  onChange={(v) => onPriceChange(trn.id, v)}
                  className="w-20 px-1 py-0.5 text-right border border-gray-300 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </td>
              <td className="px-2 py-1.5 whitespace-nowrap text-right">
                <DecimalInput
                  value={trn.editedFees}
                  onChange={(v) => onFeesChange(trn.id, v)}
                  className="w-16 px-1 py-0.5 text-right border border-gray-300 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </td>
              <td className="px-2 py-1.5 whitespace-nowrap text-right font-mono text-gray-600">
                {calculateTradeAmount(
                  trn.quantity,
                  trn.editedPrice || trn.price,
                  0,
                  trn.editedFees || 0,
                  trn.trnType,
                ).toFixed(2)}
              </td>
              <td className="px-2 py-1.5 whitespace-nowrap text-center">
                <input
                  type="checkbox"
                  checked={trn.editedStatus === "SETTLED"}
                  onChange={(e) =>
                    onStatusChange(
                      trn.id,
                      e.target.checked ? "SETTLED" : "PROPOSED",
                    )
                  }
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  title={
                    trn.editedStatus === "SETTLED" ? "Settled" : "Proposed"
                  }
                />
              </td>
              <td className="px-2 py-1.5 whitespace-nowrap">
                <input
                  type="date"
                  value={trn.editedTradeDate || trn.tradeDate}
                  onChange={(e) => onTradeDateChange(trn.id, e.target.value)}
                  className="px-1 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </td>
              <td className="px-2 py-1.5 whitespace-nowrap text-center">
                <button
                  onClick={() => onEdit(trn.portfolio.id, trn.id)}
                  className="text-blue-500 hover:text-blue-700 p-1 mr-1"
                  title="Edit transaction"
                >
                  <i className="fas fa-edit"></i>
                </button>
                <button
                  onClick={() => onDelete(trn.id)}
                  className="text-red-500 hover:text-red-700 p-1"
                  title="Delete transaction"
                >
                  <i className="fas fa-trash-alt"></i>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
