import React from "react"
import { useTranslation } from "next-i18next"
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
      // Grid/category icon
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
      // Pie chart / sector icon
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
      // Currency icon
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
      // Globe/market icon
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

/**
 * Unified toolbar component for holdings views.
 * Combines ViewToggle and GroupByControls into a single responsive row.
 * Uses icon buttons on mobile/tablet, icons + text on desktop.
 */
export const HoldingsToolbar: React.FC<HoldingsToolbarProps> = ({
  viewMode,
  onViewModeChange,
  hideGroupBy = false,
}) => {
  const { t } = useTranslation("common")
  const holdingState = useHoldingState()
  const groupOptions = useGroupOptions()

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
      {/* ViewToggle - Left side */}
      <div className="flex items-center space-x-0.5 bg-gray-100 rounded-lg p-0.5">
        <button
          onClick={() => onViewModeChange("summary")}
          className={`flex items-center space-x-1 px-2 py-1.5 text-sm font-medium rounded-md transition-colors ${
            viewMode === "summary"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
          aria-label="Summary view"
          title={t("views.summary", "Summary")}
        >
          <svg
            className="w-3.5 h-3.5"
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
          <span className="hidden md:inline text-xs">
            {t("views.summary", "Summary")}
          </span>
        </button>
        <button
          onClick={() => onViewModeChange("table")}
          className={`flex items-center space-x-1 px-2 py-1.5 text-sm font-medium rounded-md transition-colors ${
            viewMode === "table"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
          aria-label="Table view"
          title={t("views.table", "Table")}
        >
          <svg
            className="w-3.5 h-3.5"
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
          <span className="hidden md:inline text-xs">
            {t("views.table", "Table")}
          </span>
        </button>
        <button
          onClick={() => onViewModeChange("heatmap")}
          className={`flex items-center space-x-1 px-2 py-1.5 text-sm font-medium rounded-md transition-colors ${
            viewMode === "heatmap"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
          aria-label="Heatmap view"
          title={t("views.heatmap", "Heatmap")}
        >
          <svg
            className="w-3.5 h-3.5"
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
          <span className="hidden md:inline text-xs">
            {t("views.heatmap", "Heatmap")}
          </span>
        </button>
      </div>

      {/* GroupBy Controls - Right side */}
      {!hideGroupBy && (
        <div className="flex items-center space-x-0.5 bg-gray-100 rounded-lg p-0.5">
          {groupOptions.values.map((option) => (
            <button
              key={option.value}
              onClick={() => holdingState.setGroupBy(option)}
              className={`flex items-center space-x-1 px-2 py-1.5 text-sm font-medium rounded-md transition-colors ${
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
      )}
    </div>
  )
}

export default HoldingsToolbar
