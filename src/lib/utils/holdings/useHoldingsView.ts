import { useState, useMemo, useCallback, useEffect } from "react"
import { Holdings, HoldingContract } from "types/beancounter"
import { calculateHoldings } from "@lib/holdings/calculateHoldings"
import { sortPositions, SortConfig } from "@lib/holdings/sortHoldings"
import {
  transformHoldingsToAllocationSlices,
  GroupingMode,
} from "@lib/allocation/aggregateHoldings"
import { ViewMode } from "@components/features/holdings/ViewToggle"
import { useHoldingState } from "@lib/holdings/holdingState"
import {
  useUserPreferences,
  toViewMode,
  toValueIn,
  toGroupBy,
} from "@contexts/UserPreferencesContext"
import { toAllocationGroupBy } from "@components/features/holdings/GroupByOptions"
import * as Sentry from "@sentry/nextjs"

interface UseHoldingsViewResult {
  // State
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  sortConfig: SortConfig
  allocationGroupBy: GroupingMode
  excludedCategories: Set<string>

  // Handlers
  handleSort: (key: string) => void
  handleToggleCategory: (category: string) => void

  // Computed data
  holdings: Holdings | null
  allocationData: ReturnType<typeof transformHoldingsToAllocationSlices>
  allocationTotalValue: number
}

/**
 * Shared hook for holdings view state and calculations.
 * Used by both [code].tsx and aggregated.tsx pages.
 */
export function useHoldingsView(
  holdingContract: HoldingContract | undefined | null,
): UseHoldingsViewResult {
  const holdingState = useHoldingState()
  const { preferences, isLoading: preferencesLoading } = useUserPreferences()

  // Set initial view mode, valueIn, and groupBy from user preferences once loaded
  // Uses global hasInitialized to prevent resetting on page navigation
  useEffect(() => {
    if (!preferencesLoading && preferences && !holdingState.hasInitialized) {
      holdingState.setViewMode(toViewMode(preferences.defaultHoldingsView))
      // Set valueIn from preferences
      const defaultValueIn = toValueIn(preferences.defaultValueIn)
      holdingState.setValueIn({
        value: defaultValueIn,
        label: defaultValueIn,
      })
      // Set groupBy from preferences
      const defaultGroupBy = toGroupBy(preferences.defaultGroupBy)
      holdingState.setGroupBy({
        value: defaultGroupBy,
        label: defaultGroupBy,
      })
      holdingState.setHasInitialized(true)
    }
  }, [preferences, preferencesLoading, holdingState])

  // Derive allocation groupBy from the shared holdingState groupBy
  const allocationGroupBy = useMemo(
    () => toAllocationGroupBy(holdingState.groupBy.value),
    [holdingState.groupBy.value],
  )

  const [excludedCategories, setExcludedCategories] = useState<Set<string>>(
    new Set(),
  )
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "assetName",
    direction: "asc",
  })

  // Handle sorting
  const handleSort = useCallback((key: string): void => {
    setSortConfig((prevConfig) => {
      if (prevConfig.key === key) {
        return {
          key,
          direction: prevConfig.direction === "asc" ? "desc" : "asc",
        }
      }
      return {
        key,
        direction: "desc",
      }
    })
  }, [])

  // Handle toggling category exclusion in allocation view
  const handleToggleCategory = useCallback((category: string) => {
    setExcludedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }, [])

  // Calculate holdings and apply sorting
  const holdings = useMemo(() => {
    if (!holdingContract) return null

    return Sentry.startSpan(
      {
        name: "holdings.calculate",
        op: "function",
        attributes: {
          "holdings.positions": Object.keys(holdingContract.positions).length,
          "holdings.portfolio": holdingContract.portfolio?.code,
        },
      },
      () => {
        const calculatedHoldings = calculateHoldings(
          holdingContract,
          holdingState.hideEmpty,
          holdingState.valueIn.value,
          holdingState.groupBy.value,
        ) as Holdings

        // Apply sorting to each holding group
        if (sortConfig.key) {
          return Sentry.startSpan(
            { name: "holdings.sort", op: "function" },
            () => {
              const sortedHoldingGroups = {
                ...calculatedHoldings.holdingGroups,
              }
              Object.keys(sortedHoldingGroups).forEach((groupKey) => {
                sortedHoldingGroups[groupKey] = sortPositions(
                  sortedHoldingGroups[groupKey],
                  sortConfig,
                  holdingState.valueIn.value,
                )
              })
              return {
                ...calculatedHoldings,
                holdingGroups: sortedHoldingGroups,
              }
            },
          )
        }
        return calculatedHoldings
      },
    )
  }, [
    holdingContract,
    holdingState.hideEmpty,
    holdingState.valueIn.value,
    holdingState.groupBy.value,
    sortConfig,
  ])

  // Calculate allocation data from the already-calculated holdings
  // This uses the pre-calculated weightedIrr from subTotals for consistency with SubTotal display
  const allocationData = useMemo(() => {
    if (!holdings) return []
    return transformHoldingsToAllocationSlices(
      holdings,
      holdingState.valueIn.value,
    )
  }, [holdings, holdingState.valueIn.value])

  const allocationTotalValue = useMemo(() => {
    return allocationData.reduce((sum, slice) => sum + slice.value, 0)
  }, [allocationData])

  return {
    viewMode: holdingState.viewMode,
    setViewMode: holdingState.setViewMode,
    sortConfig,
    allocationGroupBy,
    excludedCategories,
    handleSort,
    handleToggleCategory,
    holdings,
    allocationData,
    allocationTotalValue,
  }
}
