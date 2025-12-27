import React from "react"
import { useTranslation } from "next-i18next"
import { useGroupOptions } from "@components/features/holdings/GroupByOptions"
import { useHoldingState } from "@lib/holdings/holdingState"

interface GroupByControlsProps {
  /** Optional: hide the label */
  hideLabel?: boolean
  /** Optional: compact mode for smaller displays */
  compact?: boolean
}

/**
 * Inline GroupBy controls component that can be used across different views.
 * Uses the holdingState context to manage the selected group.
 */
export const GroupByControls: React.FC<GroupByControlsProps> = ({
  hideLabel = false,
  compact = false,
}) => {
  const { t } = useTranslation("common")
  const holdingState = useHoldingState()
  const groupOptions = useGroupOptions()

  return (
    <div className={`flex ${compact ? "flex-wrap gap-2" : "flex-wrap gap-4"}`}>
      <div className="flex items-center space-x-2">
        {!hideLabel && (
          <span className="text-sm font-medium text-gray-700">
            {t("holdings.groupBy")}:
          </span>
        )}
        <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
          {groupOptions.values.map((option) => (
            <button
              key={option.value}
              onClick={() => holdingState.setGroupBy(option)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                holdingState.groupBy.value === option.value
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default GroupByControls
