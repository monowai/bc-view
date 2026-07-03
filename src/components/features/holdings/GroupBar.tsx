import React from "react"
import { GroupedSubtotals } from "types/beancounter"
import { getSubTotalCellClasses } from "@lib/holdings/cellClasses"
import { buildSubTotalCells } from "./SubTotal"

interface GroupBarProps extends GroupedSubtotals {
  positionCount: number
  isCollapsed: boolean
  onToggleCollapse: () => void
  /** Sticky offset (px) so the bar pins just beneath the ColumnHeader. */
  stickyTop: number
}

/**
 * Per-group section bar for the holdings table. Sticks just beneath the shared
 * {@link ColumnHeader} so the section you're reading stays labelled while you
 * scroll. When the section is collapsed the bar carries the group's subtotals
 * inline (aligned to the columns) so the figures stay visible without expanding.
 */
export default function GroupBar({
  groupBy,
  subTotals,
  valueIn,
  positionCount,
  isCollapsed,
  onToggleCollapse,
  stickyTop,
}: GroupBarProps): React.ReactElement {
  const nameCell = (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onToggleCollapse()
        }}
        className="p-0.5 rounded hover:bg-blue-200/60 transition-colors"
        aria-label={isCollapsed ? "Expand section" : "Collapse section"}
        aria-expanded={!isCollapsed}
      >
        <svg
          className={`w-4 h-4 text-blue-500 transition-transform ${
            isCollapsed ? "" : "rotate-90"
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>
      <span className="font-semibold text-sm text-blue-900">{groupBy}</span>
      <span className="text-xs text-blue-400 ml-1">
        {positionCount} {positionCount === 1 ? "holding" : "holdings"}
      </span>
    </div>
  )

  return (
    <tbody>
      <tr
        className="holding-group-bar text-xs sm:text-sm bg-blue-50 border-y border-blue-100 hover:bg-blue-100/50 transition-colors cursor-pointer"
        style={{ position: "sticky", top: stickyTop, zIndex: 20 }}
        onClick={onToggleCollapse}
      >
        {isCollapsed ? (
          <>
            <td className="px-1 py-1.5 sm:px-2 md:px-3 text-blue-900">
              {nameCell}
            </td>
            {buildSubTotalCells({ groupBy, subTotals, valueIn }).map(
              (item, index) => (
                <td
                  key={index}
                  className={`${getSubTotalCellClasses(index)} text-blue-900`}
                >
                  {item}
                </td>
              ),
            )}
          </>
        ) : (
          <td
            colSpan={14}
            className="px-1 py-1.5 sm:px-2 md:px-3 text-blue-900"
          >
            {nameCell}
          </td>
        )}
      </tr>
    </tbody>
  )
}
