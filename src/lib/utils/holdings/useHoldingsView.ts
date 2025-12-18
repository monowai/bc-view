import { useState, useMemo, useCallback, useEffect } from "react"
import { Holdings, HoldingContract } from "types/beancounter"
import { calculateHoldings } from "@lib/holdings/calculateHoldings"
import { sortPositions, SortConfig } from "@lib/holdings/sortHoldings"
import {
  transformToAllocationSlices,
  GroupingMode,
} from "@lib/allocation/aggregateHoldings"
import { ViewMode } from "@components/features/holdings/ViewToggle"
import { useHoldingState } from "@lib/holdings/holdingState"
import {
  useUserPreferences,
  toViewMode,
} from "@contexts/UserPreferencesContext"

interface UseHoldingsViewResult {
  // State
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  sortConfig: SortConfig
  allocationGroupBy: GroupingMode
  setAllocationGroupBy: (mode: GroupingMode) => void
  excludedCategories: Set<string>

  // Handlers
  handleSort: (key: string) => void
  handleToggleCategory: (category: string) => void

  // Computed data
  holdings: Holdings | null
  allocationData: ReturnType<typeof transformToAllocationSlices>
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

  // View state - initialize from user preferences
  const [viewMode, setViewMode] = useState<ViewMode>("summary")
  const [hasInitialized, setHasInitialized] = useState(false)

  // Set initial view mode from user preferences once loaded
  useEffect(() => {
    if (!preferencesLoading && preferences && !hasInitialized) {
      setViewMode(toViewMode(preferences.defaultHoldingsView))
      setHasInitialized(true)
    }
  }, [preferences, preferencesLoading, hasInitialized])
  const [allocationGroupBy, setAllocationGroupBy] =
    useState<GroupingMode>("category")
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

    const calculatedHoldings = calculateHoldings(
      holdingContract,
      holdingState.hideEmpty,
      holdingState.valueIn.value,
      holdingState.groupBy.value,
    ) as Holdings

    // Apply sorting to each holding group
    if (sortConfig.key) {
      const sortedHoldingGroups = { ...calculatedHoldings.holdingGroups }
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
    }
    return calculatedHoldings
  }, [
    holdingContract,
    holdingState.hideEmpty,
    holdingState.valueIn.value,
    holdingState.groupBy.value,
    sortConfig,
  ])

  // Calculate allocation data for allocation view
  const allocationData = useMemo(() => {
    if (!holdingContract) return []
    return transformToAllocationSlices(
      holdingContract,
      allocationGroupBy,
      holdingState.valueIn.value,
    )
  }, [holdingContract, allocationGroupBy, holdingState.valueIn.value])

  const allocationTotalValue = useMemo(() => {
    return allocationData.reduce((sum, slice) => sum + slice.value, 0)
  }, [allocationData])

  return {
    viewMode,
    setViewMode,
    sortConfig,
    allocationGroupBy,
    setAllocationGroupBy,
    excludedCategories,
    handleSort,
    handleToggleCategory,
    holdings,
    allocationData,
    allocationTotalValue,
  }
}
