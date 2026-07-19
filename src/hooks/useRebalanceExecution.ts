import { useState, useCallback, useMemo, useEffect, useRef } from "react"
import useSwr from "swr"
import { simpleFetcher } from "@utils/api/fetchHelper"
import { toErrorMessage } from "@lib/formatters"
import {
  ExecutionDto,
  ExecutionItemDto,
  ExecutionItemUpdate,
} from "types/rebalance"
import { Broker, TrnStatus } from "types/beancounter"
import { TRN_STATUS } from "types/constants"

// --- Public types ---

export interface DisplayItem extends ExecutionItemDto {
  effectiveTarget: number
  deltaValue: number
  deltaQuantity: number
  isExcluded: boolean
  isCash: boolean
  /**
   * The target weight this row was seeded with when the execution was
   * loaded/created (or last refreshed) — captured once and held stable
   * across the session regardless of subsequent edits. This is the "original"
   * a per-row reset returns to; distinct from `planTargetWeight` (the
   * model's static target, unaffected by return-adjustment or prior
   * overrides on a reloaded execution).
   */
  originalTarget: number
  /** snapshotValue + deltaValue (cash row: currentCash + netImpact, clamped to >= 0) */
  projectedValue: number
  /**
   * projectedValue / projectedTotal, as a decimal (e.g. 0.2381). `null` for
   * excluded rows (incl. server-auto-excluded PRIVATE/CPF assets) — they sit
   * outside the projected-total denominator, same as PRIVATE sits outside
   * the server's snapshotWeight denominator, so a weight against it isn't
   * meaningful.
   */
  projectedWeight: number | null
}

export interface CashSummary {
  currentMarketValue: number
  currentCash: number
  targetCash: number
  cashFromSales: number
  cashForPurchases: number
  /** cashFromSales - cashForPurchases + (currentCash - targetCash); negative means the rebalance needs new deposited cash */
  netImpact: number
  /** currentCash + netImpact, unclamped — negative means a deposit is required to fund the changes */
  projectedCash: number
}

export interface UseRebalanceExecutionParams {
  executionId?: string
  planId?: string
  portfolioIds: string[]
  filterByModel?: boolean
  /** Create an AD_HOC execution (seeded from live holdings, no plan) — requires `currency` */
  adhoc?: boolean
  /** Portfolio report currency — required when `adhoc` is true */
  currency?: string
}

export interface UseRebalanceExecutionResult {
  execution: ExecutionDto | null
  displayItems: DisplayItem[]
  activeItems: DisplayItem[]
  cashSummary: CashSummary
  brokers: Broker[]
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
    commit: () => Promise<
      | {
          portfolioId: string
          transactionStatus: TrnStatus
        }
      | undefined
    >
    targetChange: (assetId: string, value: number) => void
    excludeToggle: (assetId: string) => void
    /**
     * Sets exclusion for every non-cash, non-locked row in one pass — backs
     * the select-all header checkbox. Locked (server-enforced, e.g. PRIVATE)
     * rows are never touched: the server ignores exclusion changes on them
     * anyway, so leaving their local state alone keeps the UI honest.
     */
    setIncludeAll: (included: boolean) => void
    setAllToCurrent: () => void
    setAllToTarget: () => void
    setAllToZero: () => void
    setAllToAdjusted: () => void
    setToCurrent: (assetId: string, currentWeight: number) => void
    setToTarget: (assetId: string) => void
    /** Resets a single row's target back to its seeded `originalTarget`. */
    resetTarget: (assetId: string) => void
    setError: (msg: string | null) => void
  }
  /** Set after a new execution is created so the page can update the URL */
  createdExecutionId: string | null
}

// --- Hook ---

export function useRebalanceExecution(
  params: UseRebalanceExecutionParams,
): UseRebalanceExecutionResult {
  const { executionId, planId, portfolioIds, filterByModel, adhoc, currency } =
    params

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

  // Baseline target weight per row, captured once when the execution is
  // loaded/created (and re-captured on refresh) — never mutated by edits.
  // Backs the per-row "reset to original" affordance and the Trade column's
  // delta-vs-original label.
  const [originalTargets, setOriginalTargets] = useState<
    Record<string, number>
  >({})

  // Broker selection (settlement account auto-defaults on backend)
  const [selectedBrokerId, setSelectedBrokerId] = useState<string | undefined>(
    undefined,
  )

  // For URL update after creation
  const [createdExecutionId, setCreatedExecutionId] = useState<string | null>(
    null,
  )

  // Guards the create-execution POST against firing twice for the same
  // mount/param-set. The mount effect's re-entry guard reads `execution` /
  // `loading` from render-time state, but two effect invocations that both
  // fire before either state update commits (React 18 dev double-invoke, or
  // any re-render racing the in-flight fetch) both see the pre-create
  // snapshot and both pass the guard — each issuing its own POST and
  // orphaning a duplicate DRAFT execution. A ref is synchronous and shared
  // across those invocations, so the second one bails out immediately.
  const createInFlightRef = useRef(false)

  // --- SWR data ---

  const { data: brokersData } = useSwr(
    "/api/brokers",
    simpleFetcher("/api/brokers"),
  )
  const brokers: Broker[] = useMemo(
    () => brokersData?.data || [],
    [brokersData],
  )

  // Convenience default: if the user has exactly one broker, pre-select it.
  // No reason to make them pick from a single-item list. We only set this
  // once (when brokers first resolve) — if the user has explicitly cleared
  // the selection back to "No broker" we don't re-apply. Render-phase "store
  // previous value" pattern (mirrors the prior effect keyed on [brokers])
  // avoids a cascading effect.
  const [prevBrokers, setPrevBrokers] = useState(brokers)
  if (brokers !== prevBrokers) {
    setPrevBrokers(brokers)
    if (brokers.length === 1 && selectedBrokerId === undefined) {
      setSelectedBrokerId(brokers[0].id)
    }
  }

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
        const original: Record<string, number> = {}
        data.data.items.forEach((item: ExecutionItemDto) => {
          if (item.hasOverride) {
            overrides[item.assetId] = item.effectiveTarget
          }
          if (item.excluded) {
            exclusions[item.assetId] = true
          }
          original[item.assetId] = item.effectiveTarget
        })
        setLocalOverrides(overrides)
        setLocalExclusions(exclusions)
        setOriginalTargets(original)
      } catch (err) {
        console.error("Failed to load execution:", err)
        setError(toErrorMessage(err, "Failed to load execution"))
      } finally {
        setLoading(false)
      }
    } else {
      // Create new execution: model-based (planId) or ad-hoc (adhoc + currency).
      // Ad-hoc omits planId entirely — the server rejects AD_HOC requests that
      // supply one.
      const createBody = planId
        ? { planId, portfolioIds, filterByModel: filterByModel === true }
        : adhoc && currency
          ? { mode: "AD_HOC" as const, portfolioIds, currency }
          : null

      if (!createBody || portfolioIds.length === 0) return

      // Bail if a create is already in flight (or already succeeded) for
      // this hook instance — see createInFlightRef above.
      if (createInFlightRef.current) return
      createInFlightRef.current = true

      setLoading(true)
      setError(null)
      try {
        const response = await fetch("/api/rebalance/executions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createBody),
        })
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          setError(
            errorData.message ||
              `Failed to create execution: ${response.status}`,
          )
          // Allow a retry (e.g. via the error banner's Retry button) to
          // issue a fresh create.
          createInFlightRef.current = false
          return
        }
        const data = await response.json()
        setExecution(data.data)
        // Default to return-adjusted targets for new executions (ad-hoc
        // executions have no returnAdjustedTarget, so this is a no-op there —
        // items are already seeded with zero deltas).
        const adjustedOverrides: Record<string, number> = {}
        const original: Record<string, number> = {}
        data.data.items.forEach((item: ExecutionItemDto) => {
          if (!item.isCash && item.returnAdjustedTarget != null) {
            adjustedOverrides[item.assetId] = item.returnAdjustedTarget
          }
          // Original = whatever the row is actually seeded with (the
          // return-adjusted target when applied, else the server's own
          // effectiveTarget — e.g. cash, or ad-hoc items with none).
          original[item.assetId] =
            adjustedOverrides[item.assetId] ?? item.effectiveTarget
        })
        setLocalOverrides(adjustedOverrides)
        setOriginalTargets(original)
        // Signal that the page should update the URL
        setCreatedExecutionId(data.data.id)
      } catch (err) {
        console.error("Failed to create execution:", err)
        setError(toErrorMessage(err, "Failed to create execution"))
        createInFlightRef.current = false
      } finally {
        setLoading(false)
      }
    }
  }, [executionId, planId, portfolioIds, filterByModel, adhoc, currency])

  // Initialize on mount (skip if already loaded, loading, or errored)
  useEffect(() => {
    if (
      !execution &&
      !loading &&
      !error &&
      (executionId ||
        (planId && portfolioIds.length > 0) ||
        (adhoc && currency && portfolioIds.length > 0))
    ) {
      // Genuine async data-load orchestration: fetches/creates an execution
      // and sets state from the awaited result. Guarded against re-entry by
      // the execution/loading/error checks above. Not derivable in render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      initializeExecution()
    }
  }, [
    execution,
    loading,
    error,
    executionId,
    planId,
    portfolioIds.length,
    adhoc,
    currency,
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
          excluded: localExclusions[item.assetId] ?? item.excluded,
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
      setError(toErrorMessage(err, "Failed to save"))
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
      const original: Record<string, number> = {}
      data.data.items.forEach((item: ExecutionItemDto) => {
        if (item.hasOverride) {
          overrides[item.assetId] = item.effectiveTarget
        }
        if (item.excluded) {
          exclusions[item.assetId] = true
        }
        original[item.assetId] = item.effectiveTarget
      })
      setLocalOverrides(overrides)
      setLocalExclusions(exclusions)
      setOriginalTargets(original)
      setHasChanges(false)
    } catch (err) {
      console.error("Failed to refresh:", err)
      setError(toErrorMessage(err, "Failed to refresh"))
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

  const handleSetIncludeAll = useCallback(
    (included: boolean): void => {
      if (!execution) return
      setLocalExclusions((prev) => {
        const next = { ...prev }
        execution.items.forEach((item) => {
          // Cash isn't a toggleable row; locked (server-enforced) rows are
          // never touched by the bulk action — the server ignores exclusion
          // changes on them, so leaving local state alone keeps the select-all
          // checkbox's semantics honest about what it actually affects.
          if (item.isCash || item.locked) return
          next[item.assetId] = !included
        })
        return next
      })
      setHasChanges(true)
    },
    [execution],
  )

  const handleResetTarget = useCallback(
    (assetId: string): void => {
      const original = originalTargets[assetId]
      if (original === undefined) return
      setLocalOverrides((prev) => ({ ...prev, [assetId]: original }))
      setHasChanges(true)
    },
    [originalTargets],
  )

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
    | { portfolioId: string; transactionStatus: "PROPOSED" | "SETTLED" }
    | undefined
  > => {
    if (!execution || execution.portfolioIds.length === 0) return undefined

    setCommitting(true)
    setError(null)

    try {
      const portfolioId = execution.portfolioIds[0]
      const transactionStatus: TrnStatus = TRN_STATUS.PROPOSED

      const response = await fetch(
        `/api/rebalance/executions/${execution.id}/commit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            portfolioId,
            transactionStatus,
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

      return { portfolioId, transactionStatus }
    } catch (err) {
      console.error("Failed to commit execution:", err)
      setError(toErrorMessage(err, "Failed to commit"))
      return undefined
    } finally {
      setCommitting(false)
    }
  }, [execution, selectedBrokerId])

  // --- Computed values ---

  // Single source of truth for target-weight rescaling, projected (post-trade)
  // values/weights, and cash-impact figures. One pass over `execution.items`
  // feeds both `displayItems` (incl. the After-% column) and `cashSummary` so
  // the two never drift out of sync with independent calculations.
  const computed = useMemo(() => {
    if (!execution) {
      return {
        items: [] as DisplayItem[],
        targetCash: 0,
        cashFromSales: 0,
        cashForPurchases: 0,
        netImpact: 0,
        projectedCash: 0,
      }
    }

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

    const base = execution.items.map((item) => {
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
        // Fallback covers the render that lands between `setExecution` and
        // the paired `setOriginalTargets` call (both fire from the same
        // async handler, but state updates aren't batched across `await`
        // boundaries in every React version) — the server's own
        // `effectiveTarget` is the right seed value regardless.
        originalTarget: originalTargets[item.assetId] ?? item.effectiveTarget,
      }
    })

    // Cash impact of the trades: sales generate cash, purchases consume it,
    // and any explicit cash-target change releases/absorbs the difference.
    // Excluded rows (incl. server-auto-excluded PRIVATE/CPF assets) never
    // reach the market, so they're skipped here.
    const currentCash = execution.snapshotCashValue
    const cashDisplay = base.find((item) => item.isCash)
    const targetCash = totalPortfolioValue * (cashDisplay?.effectiveTarget ?? 0)

    let cashFromSales = 0
    let cashForPurchases = 0
    for (const item of base) {
      if (item.isCash || item.isExcluded) continue
      if (item.deltaValue < 0) {
        cashFromSales += Math.abs(item.deltaValue)
      } else if (item.deltaValue > 0) {
        cashForPurchases += item.deltaValue
      }
    }
    const cashPositionChange = currentCash - targetCash
    const netImpact = cashFromSales - cashForPurchases + cashPositionChange
    const projectedCash = currentCash + netImpact
    // Negative projected cash means the rebalance needs a deposit — it's not
    // a negative asset, so the After-% denominator clamps it to zero (the
    // deposit itself is exactly what dilutes the other rows' weights).
    const projectedCashClamped = Math.max(projectedCash, 0)

    const projectedNonCashTotal = base
      .filter((item) => !item.isCash && !item.isExcluded)
      .reduce((sum, item) => sum + (item.snapshotValue + item.deltaValue), 0)
    const projectedTotal = projectedNonCashTotal + projectedCashClamped

    const items: DisplayItem[] = base.map((item) => {
      if (item.isCash) {
        return {
          ...item,
          projectedValue: projectedCashClamped,
          projectedWeight:
            projectedTotal > 0 ? projectedCashClamped / projectedTotal : 0,
        }
      }
      const projectedValue = item.snapshotValue + item.deltaValue
      return {
        ...item,
        projectedValue,
        projectedWeight: item.isExcluded
          ? null
          : projectedTotal > 0
            ? projectedValue / projectedTotal
            : 0,
      }
    })

    return {
      items,
      targetCash,
      cashFromSales,
      cashForPurchases,
      netImpact,
      projectedCash,
    }
  }, [execution, localOverrides, localExclusions, originalTargets])

  const displayItems = computed.items

  const activeItems = useMemo(
    () =>
      displayItems.filter(
        (item) =>
          !item.isExcluded && !item.isCash && Math.abs(item.deltaValue) > 100,
      ),
    [displayItems],
  )

  const cashSummary: CashSummary = useMemo(
    () => ({
      currentMarketValue: execution?.totalPortfolioValue ?? 0,
      currentCash: execution?.snapshotCashValue ?? 0,
      targetCash: computed.targetCash,
      cashFromSales: computed.cashFromSales,
      cashForPurchases: computed.cashForPurchases,
      netImpact: computed.netImpact,
      projectedCash: computed.projectedCash,
    }),
    [execution, computed],
  )

  return {
    execution,
    displayItems,
    activeItems,
    cashSummary,
    brokers,
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
      setIncludeAll: handleSetIncludeAll,
      setAllToCurrent: handleSetAllToCurrent,
      setAllToTarget: handleSetAllToTarget,
      setAllToZero: handleSetAllToZero,
      setAllToAdjusted: handleSetAllToAdjusted,
      setToCurrent: handleSetToCurrent,
      setToTarget: handleSetToTarget,
      resetTarget: handleResetTarget,
      setError,
    },
    createdExecutionId,
  }
}
