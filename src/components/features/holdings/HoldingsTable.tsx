import React, { useCallback, useState } from "react"
import { Holdings, Portfolio } from "types/beancounter"
import { ValueInOption } from "types/constants"
import Rows from "@components/features/holdings/Rows"
import SubTotal from "@components/features/holdings/SubTotal"
import ColumnHeader from "@components/features/holdings/Header"
import GroupBar from "@components/features/holdings/GroupBar"
import GrandTotal from "@components/features/holdings/GrandTotal"
import { getGroupComparator } from "@lib/categoryMapping"
import { SortConfig } from "@lib/holdings/sortHoldings"
import { useStickyHeaderOffset } from "@lib/holdings/useStickyHeaderOffset"
import {
  useViewportFillHeight,
  HOLDINGS_GRID_BOTTOM_GAP_PX,
} from "@hooks/useViewportFillHeight"

/** Everything `Rows` takes beyond the group it renders. */
type RowActions = Omit<
  React.ComponentProps<typeof Rows>,
  "portfolio" | "groupBy" | "holdingGroup" | "valueIn"
>

interface HoldingsGrid {
  collapsedGroups: Set<string>
  toggleGroup: (groupKey: string) => void
  gridRef: (element: HTMLDivElement | null) => void
  gridMaxHeight: number | undefined
  columnHeaderRef: (element: HTMLTableSectionElement | null) => void
  headerOffset: number
}

/**
 * Table state, held by the page so collapsed sections and the measured height
 * survive a switch to another view and back.
 */
export function useHoldingsGrid(): HoldingsGrid {
  // Collapsed table sections (by groupKey). Default: all expanded.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    () => new Set<string>(),
  )
  const toggleGroup = useCallback((groupKey: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupKey)) {
        next.delete(groupKey)
      } else {
        next.add(groupKey)
      }
      return next
    })
  }, [])
  const { ref: gridRef, maxHeight: gridMaxHeight } =
    useViewportFillHeight<HTMLDivElement>(HOLDINGS_GRID_BOTTOM_GAP_PX)
  // Measure the sticky column header so per-group bars pin just beneath it.
  const { ref: columnHeaderRef, offset: headerOffset } =
    useStickyHeaderOffset<HTMLTableSectionElement>()
  return {
    collapsedGroups,
    toggleGroup,
    gridRef,
    gridMaxHeight,
    columnHeaderRef,
    headerOffset,
  }
}

interface HoldingsTableProps extends HoldingsGrid {
  holdings: Holdings
  portfolio: Portfolio
  valueIn: ValueInOption
  groupBy: string
  sortConfig: SortConfig
  onSort: (key: string) => void
  rowActions: RowActions
}

/** Scrollable holdings grid: sections of rows with subtotals and a grand total. */
export default function HoldingsTable({
  collapsedGroups,
  toggleGroup,
  gridRef,
  gridMaxHeight,
  columnHeaderRef,
  headerOffset,
  holdings,
  portfolio,
  valueIn,
  groupBy,
  sortConfig,
  onSort,
  rowActions,
}: HoldingsTableProps): React.ReactElement {
  return (
    <div
      ref={gridRef}
      style={{ maxHeight: gridMaxHeight }}
      className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100"
    >
      <table className="min-w-full bg-white">
        <ColumnHeader
          ref={columnHeaderRef}
          sortConfig={sortConfig}
          onSort={onSort}
        />
        {Object.keys(holdings.holdingGroups)
          .sort(getGroupComparator(groupBy))
          .map((groupKey) => {
            const isCollapsed = collapsedGroups.has(groupKey)
            const holdingGroup = holdings.holdingGroups[groupKey]
            return (
              <React.Fragment key={groupKey}>
                <GroupBar
                  groupBy={groupKey}
                  subTotals={holdingGroup.subTotals}
                  valueIn={valueIn}
                  isCollapsed={isCollapsed}
                  onToggleCollapse={() => toggleGroup(groupKey)}
                  stickyTop={headerOffset}
                />
                {!isCollapsed && (
                  <>
                    <Rows
                      {...rowActions}
                      portfolio={portfolio}
                      groupBy={groupKey}
                      holdingGroup={holdingGroup}
                      valueIn={valueIn}
                    />
                    <SubTotal
                      groupBy={groupKey}
                      subTotals={holdingGroup.subTotals}
                      valueIn={valueIn}
                      positionCount={holdingGroup.positions.length}
                    />
                  </>
                )}
              </React.Fragment>
            )
          })}
        <GrandTotal holdings={holdings} valueIn={valueIn} />
      </table>
    </div>
  )
}
