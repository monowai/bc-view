import React from "react"
import {
  GroupBy,
  useGroupOptions,
} from "@components/features/holdings/GroupByOptions"
import { useHoldingState } from "@lib/holdings/holdingState"
import { ViewMode } from "./ViewToggle"

interface HoldingsToolbarProps {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  /** Hide GroupBy controls (e.g., in summary view which has its own controls) */
  hideGroupBy?: boolean
}

/** Icon components for GroupBy options */
const GroupByIcon: React.FC<{ groupBy: string; className?: string }> = ({
  groupBy,
  className = "w-3.5 h-3.5",
}) => {
  switch (groupBy) {
    case GroupBy.ASSET_CLASS:
      return (
        <svg
          className={className}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
          />
        </svg>
      )
    case GroupBy.SECTOR:
      return (
        <svg
          className={className}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"
          />
        </svg>
      )
    case GroupBy.MARKET_CURRENCY:
      return (
        <svg
          className={className}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      )
    case GroupBy.MARKET:
      return (
        <svg
          className={className}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      )
    default:
      return null
  }
}

/** View mode icon component */
const ViewModeIcon: React.FC<{ mode: string; className?: string }> = ({
  mode,
  className = "w-3.5 h-3.5",
}) => {
  switch (mode) {
    case "summary":
      return (
        <svg
          className={className}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      )
    case "cards":
      return (
        <svg
          className={className}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
          />
        </svg>
      )
    case "heatmap":
      return (
        <svg
          className={className}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
          />
        </svg>
      )
    case "income":
      return (
        <svg
          className={className}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      )
    case "table":
      return (
        <svg
          className={className}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 4h18M3 10h18M3 16h18"
          />
        </svg>
      )
    default:
      return null
  }
}

const viewModes: { value: ViewMode; label: string }[] = [
  { value: "summary", label: "Summary" },
  { value: "cards", label: "Cards" },
  { value: "heatmap", label: "Heatmap" },
  { value: "income", label: "Income" },
  { value: "table", label: "Table" },
]

/**
 * Unified toolbar component for holdings views.
 * All view and grouping controls on a single row.
 */
export const HoldingsToolbar: React.FC<HoldingsToolbarProps> = ({
  viewMode,
  onViewModeChange,
  hideGroupBy = false,
}) => {
  const holdingState = useHoldingState()
  const groupOptions = useGroupOptions()

  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5 overflow-x-auto">
      {/* View Mode buttons */}
      {viewModes.map((mode) => (
        <button
          key={mode.value}
          onClick={() => onViewModeChange(mode.value)}
          className={`flex items-center space-x-1 px-2 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
            viewMode === mode.value
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
          aria-label={`${mode.label} view`}
          title={mode.label}
        >
          <ViewModeIcon mode={mode.value} />
          <span className="hidden sm:inline text-xs">{mode.label}</span>
        </button>
      ))}

      {/* Separator */}
      {!hideGroupBy && (
        <div className="w-px h-5 bg-gray-300 mx-1 flex-shrink-0" />
      )}

      {/* GroupBy buttons */}
      {!hideGroupBy &&
        groupOptions.values.map((option) => (
          <button
            key={option.value}
            onClick={() => holdingState.setGroupBy(option)}
            className={`flex items-center space-x-1 px-2 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
              holdingState.groupBy.value === option.value
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
            aria-label={option.label}
            title={option.label}
          >
            <GroupByIcon groupBy={option.value} />
            <span className="hidden md:inline text-xs">{option.label}</span>
          </button>
        ))}
    </div>
  )
}

export default HoldingsToolbar
