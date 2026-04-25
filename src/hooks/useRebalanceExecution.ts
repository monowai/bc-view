import { useState, useCallback, useMemo, useEffect } from "react"
import useSwr from "swr"
import { simpleFetcher } from "@utils/api/fetchHelper"
import {
  ExecutionDto,
  ExecutionItemDto,
  ExecutionItemUpdate,
} from "types/rebalance"
import { Asset, AssetResponse, Broker } from "types/beancounter"

// --- Public types ---

export interface DisplayItem extends ExecutionItemDto {
  effectiveTarget: number
  deltaValue: number
  deltaQuantity: number
  isExcluded: boolean
  isCash: boolean
}

export interface CashSummary {
  currentMarketValue: number
  currentCash: number
  targetCash: number
  cashFromSales: number
  cashForPurchases: number
}

export interface UseRebalanceExecutionParams {
  executionId?: string
  planId?: string
  portfolioIds: string[]
  filterByModel?: boolean
}

export interface UseRebalanceExecutionResult {
  execution: ExecutionDto | null
  displayItems: DisplayItem[]
  activeItems: DisplayItem[]
  cashSummary: CashSummary
  settlementAccounts: Asset[]
  brokers: Broker[]
  selectedSettlementAccount: string | undefined
  setSelectedSettlementAccount: (id: string | undefined) => void
  selectedBrokerId: string | undefined
  setSelectedBrokerId: (id: string | undefined) => void
  states: {
    loading: boolean
    saving: boolean
    refreshing: boolean
    committing: boolean
    hasChanges: boolean
    error: string | null
  }
  handlers: {
    initialize: () => Promise<void>
    save: () => Promise<boolean>
    refresh: () => Promise<void>
    commit: () => Promise<{ portfolioId: string } | undefined>
    targetChange: (assetId: string, value: number) => void
    excludeToggle: (assetId: string) => void
    setAllToCurrent: () => void
    setAllToTarget: () => void
    setAllToZero: () => void
    setAllToAdjusted: () => void
    setToCurrent: (assetId: string, currentWeight: number) => void
    setToTarget: (assetId: string) => void
    setError: (msg: string | null) => void
  }
  /** Set after a new execution is created so the page can update the URL */
  createdExecutionId: string | null
}

// --- Hook ---

export function useRebalanceExecution(
  params: UseRebalanceExecutionParams,
): UseRebalanceExecutionResult {
  const { executionId, planId, portfolioIds, filterByModel } = params

  // Core state
  const [execution, setExecution] = useState<ExecutionDto | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  // Local state for pending changes (synced to server on save)
  const [localOverrides, setLocalOverrides] = useState<
    Record<string, number | undefined>
  >({})
  const [localExclusions, setLocalExclusions] = useState<
    Record<string, boolean>
  >({})

  // Settlement account + broker selection
  const [selectedSettlementAccount, setSelectedSettlementAccount] = useState<
    string | undefined
  >(undefined)
  const [selectedBrokerId, setSelectedBrokerId] = useState<string | undefined>(
    undefined,
  )

  // For URL update after creation
  const [createdExecutionId, setCreatedExecutionId] = useState<string | null>(
    null,
  )

  // --- SWR data ---

  const { data: accountsData } = useSwr<AssetResponse>(
    "/api/assets?category=ACCOUNT",
    simpleFetcher,
  )

  const { data: brokersData } = useSwr(
    "/api/brokers",
    simpleFetcher("/api/brokers"),
  )
  const brokers: Broker[] = brokersData?.data || []

  const settlementAccounts = useMemo((): Asset[] => {
    if (!accountsData?.data) return []
    return Object.values(accountsData.data)
  }, [accountsData])

  // --- Operations ---

  const initializeExecution = useCallback(async () => {
    if (executionId) {
      // Load existing execution
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/rebalance/executions/${executionId}`)
        if (!response.ok) {
          setError(`Failed to load execution: ${response.status}`)
          return
        }
        const data = await response.json()
        setExecution(data.data)
        // Initialize local state from execution items
        const overrides: Record<string, number | undefined> = {}
        const exclusions: Record<string, boolean> = {}
        data.data.items.forEach((item: ExecutionItemDto) => {
          if (item.hasOverride) {
            overrides[item.assetId] = item.effectiveTarget
          }
          if (item.excluded) {
            exclusions[item.assetId] = true
          }
        })
        setLocalOverrides(overrides)
        setLocalExclusions(exclusions)
      } catch (err) {
        console.error("Failed to load execution:", err)
        setError(
          err instanceof Error ? err.message : "Failed to load execution",
        )
      } finally {
        setLoading(false)
      }
    } else if (planId && portfolioIds.length > 0) {
      // Create new execution
      setLoading(true)
      setError(null)
      try {
        const response = await fetch("/api/rebalance/executions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planId,
            portfolioIds,
            filterByModel: filterByModel === true,
          }),
        })
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          setError(
            errorData.message ||
              `Failed to create execution: ${response.status}`,
          )
          return
        }
        const data = await response.json()
        setExecution(data.data)
        // Default to return-adjusted targets for new executions
        const adjustedOverrides: Record<string, number> = {}
        data.data.items.forEach((item: ExecutionItemDto) => {
          if (!item.isCash && item.returnAdjustedTarget != null) {
            adjustedOverrides[item.assetId] = item.returnAdjustedTarget
          }
        })
        setLocalOverrides(adjustedOverrides)
        // Signal that the page should update the URL
        setCreatedExecutionId(data.data.id)
      } catch (err) {
        console.error("Failed to create execution:", err)
        setError(
          err instanceof Error ? err.message : "Failed to create execution",
        )
      } finally {
        setLoading(false)
      }
    }
  }, [executionId, planId, portfolioIds, filterByModel])

  // Initialize on mount (skip if already loaded, loading, or errored)
  useEffect(() => {
    if (
      !execution &&
      !loading &&
      !error &&
      (executionId || (planId && portfolioIds.length > 0))
    ) {
      initializeExecution()
    }
  }, [
    execution,
    loading,
    error,
    executionId,
    planId,
    portfolioIds.length,
    initializeExecution,
  ])

  // Save execution changes
  const handleSave = useCallback(async (): Promise<boolean> => {
    if (!execution) return false

    setSaving(true)
    try {
      const itemUpdates: ExecutionItemUpdate[] = execution.items.map(
        (item) => ({
          assetId: item.assetId,
          effectiveTargetOverride: localOverrides[item.assetId],
          excluded: localExclusions[item.assetId] ?? false,
        }),
      )

      const response = await fetch(
        `/api/rebalance/executions/${execution.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemUpdates,
          }),
        },
      )

      if (!response.ok) {
        setError(`Failed to save: ${response.status}`)
        return false
      }

      const data = await response.json()
      setExecution(data.data)
      setHasChanges(false)
      return true
    } catch (err) {
      console.error("Failed to save execution:", err)
      setError(err instanceof Error ? err.message : "Failed to save")
      return false
    } finally {
      setSaving(false)
    }
  }, [execution, localOverrides, localExclusions])

  // Refresh holdings
  const handleRefresh = useCallback(async () => {
    if (!execution) return

    // Save any pending changes first
    if (hasChanges) {
      await handleSave()
    }

    setRefreshing(true)
    try {
      const response = await fetch(
        `/api/rebalance/executions/${execution.id}/refresh`,
        { method: "POST" },
      )

      if (!response.ok) {
        setError(`Failed to refresh: ${response.status}`)
        return
      }

      const data = await response.json()
      setExecution(data.data)
      // Re-initialize local state
      const overrides: Record<string, number | undefined> = {}
      const exclusions: Record<string, boolean> = {}
      data.data.items.forEach((item: ExecutionItemDto) => {
        if (item.hasOverride) {
          overrides[item.assetId] = item.effectiveTarget
        }
        if (item.excluded) {
          exclusions[item.assetId] = true
        }
      })
      setLocalOverrides(overrides)
      setLocalExclusions(exclusions)
      setHasChanges(false)
    } catch (err) {
      console.error("Failed to refresh:", err)
      setError(err instanceof Error ? err.message : "Failed to refresh")
    } finally {
      setRefreshing(false)
    }
  }, [execution, hasChanges, handleSave])

  // --- Target change handlers ---

  const handleTargetChange = useCallback(
    (assetId: string, value: number): void => {
      setLocalOverrides((prev) => ({ ...prev, [assetId]: value }))
      setHasChanges(true)
    },
    [],
  )

  const handleExcludeToggle = useCallback((assetId: string): void => {
    setLocalExclusions((prev) => ({ ...prev, [assetId]: !prev[assetId] }))
    setHasChanges(true)
  }, [])

  const handleSetAllToCurrent = useCallback((): void => {
    if (!execution) return
    const overrides: Record<string, number> = {}
    execution.items.forEach((item) => {
      if (!item.isCash) {
        overrides[item.assetId] = item.snapshotWeight
      }
    })
    setLocalOverrides(overrides)
    setHasChanges(true)
  }, [execution])

  const handleSetAllToTarget = useCallback((): void => {
    setLocalOverrides({})
    setLocalExclusions({})
    setHasChanges(true)
  }, [])

  const handleSetAllToZero = useCallback((): void => {
    if (!execution) return
    const overrides: Record<string, number> = {}
    execution.items.forEach((item) => {
      if (item.isCash) {
        overrides[item.assetId] = 1 // Cash becomes 100%
      } else {
        overrides[item.assetId] = 0
      }
    })
    setLocalOverrides(overrides)
    setLocalExclusions({})
    setHasChanges(true)
  }, [execution])

  const handleSetAllToAdjusted = useCallback((): void => {
    if (!execution) return
    const overrides: Record<string, number> = {}
    execution.items.forEach((item) => {
      if (!item.isCash && item.returnAdjustedTarget != null) {
        overrides[item.assetId] = item.returnAdjustedTarget
      }
    })
    setLocalOverrides(overrides)
    setHasChanges(true)
  }, [execution])

  const handleSetToCurrent = useCallback(
    (assetId: string, currentWeight: number): void => {
      setLocalOverrides((prev) => ({ ...prev, [assetId]: currentWeight }))
      setHasChanges(true)
    },
    [],
  )

  const handleSetToTarget = useCallback((assetId: string): void => {
    setLocalOverrides((prev) => {
      const newOverrides = { ...prev }
      delete newOverrides[assetId]
      return newOverrides
    })
    setLocalExclusions((prev) => {
      const newExcluded = { ...prev }
      delete newExcluded[assetId]
      return newExcluded
    })
    setHasChanges(true)
  }, [])

  // Commit execution - create transactions
  const handleCommit = useCallback(async (): Promise<
    { portfolioId: string } | undefined
  > => {
    if (!execution || execution.portfolioIds.length === 0) return undefined

    setCommitting(true)
    setError(null)

    try {
      const portfolioId = execution.portfolioIds[0]

      const response = await fetch(
        `/api/rebalance/executions/${execution.id}/commit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            portfolioId,
            transactionStatus: "PROPOSED",
            cashAssetId: selectedSettlementAccount,
            brokerId: selectedBrokerId,
          }),
        },
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        setError(
          errorData.message || `Failed to commit execution: ${response.status}`,
        )
        return undefined
      }

      return { portfolioId }
    } catch (err) {
      console.error("Failed to commit execution:", err)
      setError(err instanceof Error ? err.message : "Failed to commit")
      return undefined
    } finally {
      setCommitting(false)
    }
  }, [execution, selectedSettlementAccount, selectedBrokerId])

  // --- Computed values ---

  const displayItems: DisplayItem[] = useMemo(() => {
    if (!execution) return []

    const totalPortfolioValue = execution.totalPortfolioValue

    // Find the cash item - cash stays at current weight by default (not scaled)
    const cashItem = execution.items.find((item) => item.isCash)
    const cashEffectiveTarget = cashItem
      ? (localOverrides[cashItem.assetId] ?? cashItem.snapshotWeight)
      : 0

    // Calculate available allocation for non-cash assets (1 - cash target)
    const availableForAssets = 1 - cashEffectiveTarget

    // Sum of PLAN target weights for all non-cash assets (for proportional scaling)
    const totalPlanTargetWeights = execution.items
      .filter((item) => !item.isCash)
      .reduce((sum, item) => sum + item.planTargetWeight, 0)

    return execution.items.map((item) => {
      const isCash = item.isCash ?? false
      const isExcluded = localExclusions[item.assetId] ?? item.excluded

      let effectiveTarget: number
      if (isCash) {
        effectiveTarget = localOverrides[item.assetId] ?? item.snapshotWeight
      } else if (localOverrides[item.assetId] !== undefined) {
        effectiveTarget = localOverrides[item.assetId]!
      } else {
        effectiveTarget =
          totalPlanTargetWeights > 0
            ? (item.planTargetWeight / totalPlanTargetWeights) *
              availableForAssets
            : 0
      }

      const targetValue = totalPortfolioValue * effectiveTarget
      const deltaValue = targetValue - item.snapshotValue
      const price = item.snapshotPrice || 0
      const deltaQuantity = isCash
        ? deltaValue
        : price > 0
          ? Math.round(deltaValue / price)
          : 0

      return {
        ...item,
        effectiveTarget,
        deltaValue,
        deltaQuantity,
        isExcluded,
        isCash,
      }
    })
  }, [execution, localOverrides, localExclusions])

  const activeItems = useMemo(
    () =>
      displayItems.filter(
        (item) =>
          !item.isExcluded && !item.isCash && Math.abs(item.deltaValue) > 100,
      ),
    [displayItems],
  )

  const cashSummary: CashSummary = useMemo(() => {
    if (!execution) {
      return {
        currentMarketValue: 0,
        currentCash: 0,
        targetCash: 0,
        cashFromSales: 0,
        cashForPurchases: 0,
      }
    }

    const cashItem = displayItems.find((item) => item.isCash)
    const targetCash =
      execution.totalPortfolioValue * (cashItem?.effectiveTarget ?? 0)

    let cashFromSales = 0
    let cashForPurchases = 0

    for (const item of displayItems) {
      if (item.isCash || item.isExcluded) continue
      if (item.deltaValue < 0) {
        cashFromSales += Math.abs(item.deltaValue)
      } else if (item.deltaValue > 0) {
        cashForPurchases += item.deltaValue
      }
    }

    return {
      currentMarketValue: execution.totalPortfolioValue,
      currentCash: execution.snapshotCashValue,
      targetCash,
      cashFromSales,
      cashForPurchases,
    }
  }, [execution, displayItems])

  return {
    execution,
    displayItems,
    activeItems,
    cashSummary,
    settlementAccounts,
    brokers,
    selectedSettlementAccount,
    setSelectedSettlementAccount,
    selectedBrokerId,
    setSelectedBrokerId,
    states: {
      loading,
      saving,
      refreshing,
      committing,
      hasChanges,
      error,
    },
    handlers: {
      initialize: initializeExecution,
      save: handleSave,
      refresh: handleRefresh,
      commit: handleCommit,
      targetChange: handleTargetChange,
      excludeToggle: handleExcludeToggle,
      setAllToCurrent: handleSetAllToCurrent,
      setAllToTarget: handleSetAllToTarget,
      setAllToZero: handleSetAllToZero,
      setAllToAdjusted: handleSetAllToAdjusted,
      setToCurrent: handleSetToCurrent,
      setToTarget: handleSetToTarget,
      setError,
    },
    createdExecutionId,
  }
}
