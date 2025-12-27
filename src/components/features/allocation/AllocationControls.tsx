import React from "react"
import { useTranslation } from "next-i18next"
import { GroupingMode } from "@lib/allocation/aggregateHoldings"
import { ValueIn } from "@components/features/holdings/GroupByOptions"

interface AllocationControlsProps {
  groupBy: GroupingMode
  onGroupByChange: (groupBy: GroupingMode) => void
  valueIn: ValueIn
  onValueInChange: (valueIn: ValueIn) => void
  hideValueIn?: boolean
}

export const AllocationControls: React.FC<AllocationControlsProps> = ({
  groupBy,
  onGroupByChange,
  valueIn,
  onValueInChange,
  hideValueIn = false,
}) => {
  const { t } = useTranslation("common")

  const groupOptions: { value: GroupingMode; label: string }[] = [
    { value: "category", label: t("allocation.groupBy.category", "Category") },
    { value: "sector", label: t("allocation.groupBy.sector", "Sector") },
    { value: "asset", label: t("allocation.groupBy.asset", "Asset") },
    { value: "market", label: t("allocation.groupBy.market", "Market") },
  ]

  const valueInOptions: { value: ValueIn; label: string }[] = [
    { value: ValueIn.PORTFOLIO, label: t("valueIn.portfolio", "Portfolio") },
    { value: ValueIn.BASE, label: t("valueIn.base", "Base") },
    { value: ValueIn.TRADE, label: t("valueIn.trade", "Trade") },
  ]

  return (
    <div className="flex flex-wrap gap-4 mb-6">
      <div className="flex items-center space-x-2">
        <span className="text-sm font-medium text-gray-700">
          {t("allocation.groupBy.label", "Group by")}:
        </span>
        <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
          {groupOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => onGroupByChange(option.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                groupBy === option.value
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {!hideValueIn && (
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">
            {t("allocation.valueIn.label", "Value in")}:
          </span>
          <select
            value={valueIn}
            onChange={(e) => onValueInChange(e.target.value as ValueIn)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {valueInOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}

export default AllocationControls
