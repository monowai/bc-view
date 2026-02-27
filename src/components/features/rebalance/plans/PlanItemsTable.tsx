import React from "react"
import { PlanItemDto } from "types/rebalance"
import { FormatValue } from "@components/ui/MoneyUtils"
import {
  tableContainer,
  tbodyBase,
  trHover,
  hiddenSm,
} from "@utils/tableStyles"

interface PlanItemsTableProps {
  items: PlanItemDto[]
  currencySymbol: string
}

const ActionBadge: React.FC<{ action: "BUY" | "SELL" | "HOLD" }> = ({
  action,
}) => {
  const colors = {
    BUY: "bg-green-100 text-green-700",
    SELL: "bg-red-100 text-red-700",
    HOLD: "bg-gray-100 text-gray-600",
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[action]}`}
    >
      {action}
    </span>
  )
}

const PlanItemsTable: React.FC<PlanItemsTableProps> = ({
  items,
  currencySymbol,
}) => {
  if (items.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-600">{"No items in this plan"}</p>
      </div>
    )
  }

  return (
    <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
      <div className={tableContainer}>
        <table className="min-w-full">
          <thead className="bg-gray-100">
            <tr className="border-b border-gray-200">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">
                {"Asset"}
              </th>
              <th
                className={`px-4 py-3 text-right text-xs font-medium text-gray-700 ${hiddenSm}`}
              >
                {"Current Qty"}
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-700">
                {"Current"}
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-700">
                {"Curr %"}
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-700">
                {"Target %"}
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-700">
                {"Target"}
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-700">
                {"Action"}
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-700">
                {"Delta"}
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-700">
                {"Status"}
              </th>
            </tr>
          </thead>
          <tbody className={tbodyBase}>
            {items.map((item) => (
              <tr
                key={item.id}
                className={`${trHover} ${
                  item.locked ? "bg-gray-50" : ""
                } ${item.excluded ? "opacity-60" : ""}`}
              >
                <td className="px-4 py-3">
                  <div
                    className="font-medium text-sm"
                    title={item.assetName || item.assetId}
                  >
                    {item.assetCode || item.assetId}
                  </div>
                  {item.assetName && (
                    <div className="text-xs text-gray-500 truncate max-w-[200px]">
                      {item.assetName}
                    </div>
                  )}
                </td>
                <td className={`px-4 py-3 text-right text-sm ${hiddenSm}`}>
                  <FormatValue value={item.currentQuantity} />
                </td>
                <td className="px-4 py-3 text-right text-sm">
                  {currencySymbol}
                  <FormatValue value={item.currentValue} />
                </td>
                <td className="px-4 py-3 text-center text-sm">
                  {(item.currentWeight * 100).toFixed(1)}%
                </td>
                <td className="px-4 py-3 text-center text-sm font-medium">
                  {(item.targetWeight * 100).toFixed(1)}%
                </td>
                <td className="px-4 py-3 text-right text-sm">
                  {currencySymbol}
                  <FormatValue value={item.targetValue} />
                </td>
                <td className="px-4 py-3 text-center">
                  <ActionBadge action={item.action} />
                </td>
                <td className="px-4 py-3 text-right text-sm">
                  <span
                    className={
                      item.deltaValue > 0
                        ? "text-green-600"
                        : item.deltaValue < 0
                          ? "text-red-600"
                          : ""
                    }
                  >
                    {item.deltaValue > 0 ? "+" : ""}
                    {currencySymbol}
                    <FormatValue value={item.deltaValue} />
                  </span>
                  {item.deltaQuantity !== 0 && (
                    <div className="text-xs text-gray-500">
                      {item.deltaQuantity > 0 ? "+" : ""}
                      {item.deltaQuantity.toFixed(0)} units
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {item.locked ? (
                    <span className="inline-flex items-center text-xs text-purple-600">
                      <i className="fas fa-lock mr-1"></i>
                      {"Locked"}
                    </span>
                  ) : item.excluded ? (
                    <span className="inline-flex items-center text-xs text-gray-500">
                      <i className="fas fa-ban mr-1"></i>
                      {"Excluded"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-xs text-green-600">
                      <i className="fas fa-check mr-1"></i>
                      {"Eligible"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default PlanItemsTable
