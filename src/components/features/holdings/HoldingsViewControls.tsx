import React from "react"
import { ViewMode, VIEW_MODES } from "./ViewToggle"
import {
  GroupBy,
  useGroupOptions,
} from "@components/features/holdings/GroupByOptions"
import { useHoldingState } from "@lib/holdings/holdingState"

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
    case "chart":
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
            d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
          />
        </svg>
      )
    default:
      return null
  }
}

/** GroupBy icon component */
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

interface HoldingsViewControlsProps {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  hideGroupBy?: boolean
}

/** Left side of the holdings toolbar: view mode and GroupBy icon buttons. */
const HoldingsViewControls: React.FC<HoldingsViewControlsProps> = ({
  viewMode,
  onViewModeChange,
  hideGroupBy = false,
}) => {
  const holdingState = useHoldingState()
  const groupOptions = useGroupOptions()

  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      {/* View Mode section */}
      <div className="flex items-center gap-0.5 bg-slate-100/80 backdrop-blur-sm rounded-lg p-0.5 border border-slate-200/60 shadow-sm">
        {VIEW_MODES.map((mode) => (
          <button
            key={mode.value}
            onClick={() => onViewModeChange(mode.value)}
            className={`flex items-center justify-center w-7 h-7 rounded-md transition-all duration-200 ${
              viewMode === mode.value
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/50"
                : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
            }`}
            aria-label={`${mode.label} view`}
            title={mode.label}
          >
            <ViewModeIcon
              mode={mode.value}
              className={`w-3.5 h-3.5 ${viewMode === mode.value ? "text-blue-500" : ""}`}
            />
          </button>
        ))}
      </div>

      {/* GroupBy section */}
      {!hideGroupBy && (
        <div className="flex items-center gap-0.5 bg-amber-50/80 backdrop-blur-sm rounded-lg p-0.5 border border-amber-200/60 shadow-sm">
          {groupOptions.values.map((option) => (
            <button
              key={option.value}
              onClick={() => holdingState.setGroupBy(option)}
              className={`flex items-center justify-center w-7 h-7 rounded-md transition-all duration-200 ${
                holdingState.groupBy.value === option.value
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-amber-200/50"
                  : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
              }`}
              aria-label={option.label}
              title={option.label}
            >
              <GroupByIcon
                groupBy={option.value}
                className={`w-3.5 h-3.5 ${holdingState.groupBy.value === option.value ? "text-amber-500" : ""}`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default HoldingsViewControls
