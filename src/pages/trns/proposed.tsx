import React, { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/router"
import useSwr, { mutate } from "swr"
import { fetcher, simpleFetcher, portfoliosKey } from "@utils/api/fetchHelper"
import { rootLoader } from "@components/ui/PageLoader"
import { Broker, Portfolio, Transaction, TrnStatus } from "types/beancounter"
import { ProposedTransaction, AggregatedTransaction } from "types/proposed"
import Head from "next/head"
import { useUser } from "@auth0/nextjs-auth0/client"
import { calculateTradeAmount } from "@utils/trns/tradeUtils"
import { stripOwnerPrefix } from "@lib/assets/assetUtils"
import { solePortfolio as soleActivePortfolio } from "@lib/user/zenMode"
import DateInput from "@components/ui/DateInput"
import Alert from "@components/ui/Alert"
import ConfirmDialog from "@components/ui/ConfirmDialog"
import DetailedTransactionsTable from "@components/features/transactions/DetailedTransactionsTable"
import AggregatedTransactionsTable from "@components/features/transactions/AggregatedTransactionsTable"
import {
  getToday,
  getDateOffset,
  getSessionValue,
  setSessionValue,
} from "@lib/sessionStorage"

// Session storage keys for filter preferences
const SESSION_KEY_INCLUDE_SETTLED = "proposed-include-settled"
const SESSION_KEY_AGGREGATE_VIEW = "proposed-aggregate-view"
const SESSION_KEY_SCOPE = "proposed-scope"
const SESSION_KEY_FROM = "proposed-from"
const SESSION_KEY_TO = "proposed-to"
const SESSION_KEY_FILTERS_OPEN = "proposed-filters-open"

// The filter panel is heavy on a phone, so default it collapsed on mobile
// (< sm) and expanded on larger screens. A manual toggle is persisted and
// overrides this default thereafter.
const defaultFiltersOpen = (): boolean =>
  typeof window === "undefined"
    ? true
    : window.matchMedia("(min-width: 640px)").matches

// The review window defaults to a tight t-1..t+1 band: yesterday catches
// just-executed trades, tomorrow surfaces imminently-due proposed rows
// (e.g. a dividend paying out the next day).
const defaultFrom = (): string => getDateOffset(-1)
const defaultTo = (): string => getDateOffset(1)

type ProposedScope = "OWNED" | "MANAGED" | "ALL"

// Get display code for an asset, stripping owner ID prefix for private assets
const getAssetDisplayCode = (asset: { code: string }): string => {
  return stripOwnerPrefix(asset.code)
}

export default function ProposedTransactions(): React.JSX.Element {
  const { user, isLoading: userLoading } = useUser()
  const router = useRouter()

  const [transactions, setTransactions] = useState<ProposedTransaction[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [includeSettled, setIncludeSettled] = useState(false)
  // The review window. Proposed rows are bounded "due on or before" toDate;
  // settled rows are filtered to tradeDate within fromDate..toDate.
  const [fromDate, setFromDate] = useState(defaultFrom())
  const [toDate, setToDate] = useState(defaultTo())
  const [settledTransactions, setSettledTransactions] = useState<Transaction[]>(
    [],
  )
  const [settledLoading, setSettledLoading] = useState(false)
  const [settledError, setSettledError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [typeFilter, setTypeFilter] = useState<string>("ALL")
  const [brokerFilter, setBrokerFilter] = useState<string>("ALL")
  const [scope, setScope] = useState<ProposedScope>("ALL")
  const [isSettling, setIsSettling] = useState(false)
  const [isUnsettling, setIsUnsettling] = useState(false)
  const [aggregateView, setAggregateView] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [editTarget, setEditTarget] = useState<{
    portfolioId: string
    trnId: string
  } | null>(null)
  const [sessionInitialized, setSessionInitialized] = useState(false)

  // Initialize filter states from session storage on mount. This must run
  // post-hydration (sessionStorage is client-only) and gates the persistence
  // effects via sessionInitialized; lazy useState initializers would read
  // storage during SSR and cause a hydration mismatch, so an effect is required.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setIncludeSettled(getSessionValue(SESSION_KEY_INCLUDE_SETTLED, false))
    setFromDate(getSessionValue(SESSION_KEY_FROM, defaultFrom()))
    setToDate(getSessionValue(SESSION_KEY_TO, defaultTo()))
    setAggregateView(getSessionValue(SESSION_KEY_AGGREGATE_VIEW, false))
    setFiltersOpen(
      getSessionValue(SESSION_KEY_FILTERS_OPEN, defaultFiltersOpen()),
    )
    const storedScope = getSessionValue<ProposedScope>(SESSION_KEY_SCOPE, "ALL")
    if (
      storedScope === "OWNED" ||
      storedScope === "MANAGED" ||
      storedScope === "ALL"
    ) {
      setScope(storedScope)
    }
    setSessionInitialized(true)
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (sessionInitialized) {
      setSessionValue(SESSION_KEY_SCOPE, scope)
    }
  }, [scope, sessionInitialized])

  // Persist filter changes to session storage (only after initialization)
  useEffect(() => {
    if (sessionInitialized) {
      setSessionValue(SESSION_KEY_INCLUDE_SETTLED, includeSettled)
    }
  }, [includeSettled, sessionInitialized])

  useEffect(() => {
    if (sessionInitialized) {
      setSessionValue(SESSION_KEY_FROM, fromDate)
    }
  }, [fromDate, sessionInitialized])

  useEffect(() => {
    if (sessionInitialized) {
      setSessionValue(SESSION_KEY_TO, toDate)
    }
  }, [toDate, sessionInitialized])

  useEffect(() => {
    if (sessionInitialized) {
      setSessionValue(SESSION_KEY_AGGREGATE_VIEW, aggregateView)
    }
  }, [aggregateView, sessionInitialized])

  useEffect(() => {
    if (sessionInitialized) {
      setSessionValue(SESSION_KEY_FILTERS_OPEN, filtersOpen)
    }
  }, [filtersOpen, sessionInitialized])

  // Fetch proposed transactions across all portfolios, bounded to those due on or before toDate.
  const proposedKey = user
    ? `/api/trns/proposed?scope=${scope}&asAt=${toDate}`
    : null
  const { data: proposedData, error: fetchError } = useSwr<{
    data: Transaction[]
  }>(proposedKey, fetcher, { refreshInterval: 0 })

  // Portfolios — only to offer a "go to your portfolio" shortcut when there's
  // nothing to review. Fetched solely on the empty path (when proposed has
  // loaded and is empty) so the common case doesn't pay for an unused list.
  const proposedEmpty = (proposedData?.data?.length ?? 1) === 0
  const { data: portfoliosData } = useSwr<{ data: Portfolio[] }>(
    user && proposedEmpty ? portfoliosKey : null,
    simpleFetcher(portfoliosKey),
  )
  const solePortfolio = useMemo(
    () => soleActivePortfolio(portfoliosData?.data ?? []),
    [portfoliosData],
  )

  // Fetch brokers for dropdown
  const { data: brokersData } = useSwr(
    user ? "/api/brokers" : null,
    simpleFetcher("/api/brokers"),
  )
  const brokers: Broker[] = useMemo(
    () => brokersData?.data || [],
    [brokersData?.data],
  )

  // Fetch settled transactions when checkbox is checked
  useEffect(() => {
    if (!includeSettled) {
      // Clearing here keeps the async-fetched list and the checkbox in sync;
      // the fetch below is the effect's primary external-sync purpose.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSettledTransactions([])
      return
    }

    const fetchSettled = async (): Promise<void> => {
      setSettledLoading(true)
      setSettledError(null)
      try {
        const response = await fetch(
          `/api/trns/settled?from=${fromDate}&to=${toDate}`,
        )
        if (!response.ok) {
          setSettledError(`Failed to fetch: ${response.statusText}`)
          return
        }
        const data = await response.json()
        setSettledTransactions(data.data || [])
      } catch (err) {
        console.error("Error fetching settled transactions:", err)
        setSettledError("Failed to load settled transactions")
      } finally {
        setSettledLoading(false)
      }
    }

    fetchSettled()
  }, [includeSettled, fromDate, toDate])

  // Rebuild the editable transaction list whenever the underlying data or
  // filter changes. Render-phase "store previous value" pattern instead of an
  // effect: rebuilding here (and discarding in-progress edits on data change)
  // matches the prior effect behavior while avoiding a cascading render.
  const buildTransactions = (): ProposedTransaction[] => {
    // Combine proposed transactions with settled transactions (if included)
    const proposed = proposedData?.data || []
    const settled = includeSettled ? settledTransactions : []

    // Combine and deduplicate by ID
    const allTransactions = [...proposed]
    settled.forEach((trn) => {
      if (!allTransactions.find((t) => t.id === trn.id)) {
        allTransactions.push(trn)
      }
    })

    // Apply type filter
    const typeFiltered =
      typeFilter === "ALL"
        ? allTransactions
        : allTransactions.filter((trn) => trn.trnType === typeFilter)

    // Apply broker filter — display-only; never mutates the transactions
    const filtered =
      brokerFilter === "ALL"
        ? typeFiltered
        : typeFiltered.filter(
            (trn) => (trn.broker?.id || trn.brokerId) === brokerFilter,
          )

    const sorted = filtered.sort((a, b) => {
      // Sort by broker name first
      const brokerA = a.broker?.name || ""
      const brokerB = b.broker?.name || ""
      const brokerCompare = brokerA.localeCompare(brokerB)
      if (brokerCompare !== 0) return brokerCompare
      // Then by portfolio code
      const portfolioCompare = a.portfolio.code.localeCompare(b.portfolio.code)
      if (portfolioCompare !== 0) return portfolioCompare
      // Then by asset code (using display code to sort by visible name)
      return getAssetDisplayCode(a.asset).localeCompare(
        getAssetDisplayCode(b.asset),
      )
    })
    return sorted.map((trn) => ({
      ...trn,
      editedPrice: trn.price,
      editedFees: trn.fees,
      editedStatus: trn.status,
      editedTradeDate: trn.tradeDate,
      editedBrokerId: trn.broker?.id || trn.brokerId,
    }))
  }

  const [prevTrnInputs, setPrevTrnInputs] = useState<{
    proposedData: typeof proposedData
    settledTransactions: Transaction[]
    includeSettled: boolean
    typeFilter: string
    brokerFilter: string
  }>({
    proposedData,
    settledTransactions,
    includeSettled,
    typeFilter,
    brokerFilter,
  })
  if (
    prevTrnInputs.proposedData !== proposedData ||
    prevTrnInputs.settledTransactions !== settledTransactions ||
    prevTrnInputs.includeSettled !== includeSettled ||
    prevTrnInputs.typeFilter !== typeFilter ||
    prevTrnInputs.brokerFilter !== brokerFilter
  ) {
    setPrevTrnInputs({
      proposedData,
      settledTransactions,
      includeSettled,
      typeFilter,
      brokerFilter,
    })
    setTransactions(buildTransactions())
  }

  // Clear selection when filter changes. Render-phase "store previous value"
  // pattern instead of an effect — resets synchronously on the same render
  // that the filter changed, avoiding a cascading render.
  const [prevFilterKey, setPrevFilterKey] = useState(
    `${typeFilter}:${brokerFilter}:${aggregateView}`,
  )
  const filterKey = `${typeFilter}:${brokerFilter}:${aggregateView}`
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey)
    setSelectedIds(new Set())
  }

  // Compute aggregated transactions when aggregate view is enabled. Purely
  // derived from transactions/brokers, so a useMemo replaces the prior effect
  // (which recomputed from scratch on every transactions change anyway).
  const aggregatedTransactions = useMemo<AggregatedTransaction[]>(() => {
    if (!aggregateView) {
      return []
    }

    // Group transactions by broker + asset + trnType
    const groups = new Map<string, ProposedTransaction[]>()
    transactions.forEach((trn) => {
      const brokerId = trn.editedBrokerId || trn.broker?.id || ""
      const key = `${brokerId}:${trn.asset.id}:${trn.trnType}`
      const existing = groups.get(key) || []
      existing.push(trn)
      groups.set(key, existing)
    })

    // Create aggregated transactions
    const aggregated: AggregatedTransaction[] = []
    groups.forEach((trns, key) => {
      const first = trns[0]
      const totalQuantity = trns.reduce((sum, t) => sum + t.quantity, 0)
      const totalFees = trns.reduce(
        (sum, t) => sum + (t.editedFees ?? t.fees ?? 0),
        0,
      )
      const totalAmount = trns.reduce(
        (sum, t) =>
          sum +
          calculateTradeAmount(
            t.quantity,
            t.editedPrice ?? t.price,
            0,
            t.editedFees ?? t.fees ?? 0,
            t.trnType,
          ),
        0,
      )
      // Weighted average price
      const avgPrice =
        totalQuantity > 0
          ? trns.reduce(
              (sum, t) => sum + (t.editedPrice ?? t.price) * t.quantity,
              0,
            ) / totalQuantity
          : 0

      const broker = brokers.find(
        (b) => b.id === (first.editedBrokerId || first.broker?.id),
      )

      aggregated.push({
        aggregateKey: key,
        brokerId: first.editedBrokerId || first.broker?.id,
        brokerName: broker?.name || first.broker?.name || "",
        assetId: first.asset.id,
        assetCode: getAssetDisplayCode(first.asset),
        assetName: first.asset.name,
        assetMarket: first.asset.market,
        trnType: first.trnType,
        tradeCurrency: first.tradeCurrency,
        totalQuantity,
        avgPrice,
        totalFees,
        totalAmount,
        transactionIds: trns.map((t) => t.id),
        transactions: trns,
        editedPrice: avgPrice,
        editedFees: totalFees,
        editedStatus: first.editedStatus,
        editedTradeDate: first.editedTradeDate,
      })
    })

    // Sort by broker name, then asset code
    aggregated.sort((a, b) => {
      const brokerCompare = a.brokerName.localeCompare(b.brokerName)
      if (brokerCompare !== 0) return brokerCompare
      return a.assetCode.localeCompare(b.assetCode)
    })

    return aggregated
  }, [aggregateView, transactions, brokers])

  const handlePriceChange = (id: string, value: number): void => {
    setTransactions((prev) =>
      prev.map((trn) => (trn.id === id ? { ...trn, editedPrice: value } : trn)),
    )
  }

  const handleFeesChange = (id: string, value: number): void => {
    setTransactions((prev) =>
      prev.map((trn) => (trn.id === id ? { ...trn, editedFees: value } : trn)),
    )
  }

  const handleStatusChange = (id: string, value: TrnStatus): void => {
    setTransactions((prev) =>
      prev.map((trn) => {
        if (trn.id !== id) return trn
        // When changing to SETTLED, default tradeDate to today
        const updates: Partial<ProposedTransaction> = { editedStatus: value }
        if (value === "SETTLED" && trn.editedStatus !== "SETTLED") {
          updates.editedTradeDate = getToday()
        }
        return { ...trn, ...updates }
      }),
    )
  }

  const handleTradeDateChange = (id: string, value: string): void => {
    setTransactions((prev) =>
      prev.map((trn) =>
        trn.id === id ? { ...trn, editedTradeDate: value } : trn,
      ),
    )
  }

  const handleBrokerChange = (id: string, value: string): void => {
    setTransactions((prev) =>
      prev.map((trn) =>
        trn.id === id ? { ...trn, editedBrokerId: value || undefined } : trn,
      ),
    )
  }

  // Handlers for aggregated transaction edits
  const handleAggregatedPriceChange = (
    aggregateKey: string,
    value: number,
  ): void => {
    // Update all underlying transactions with the new price
    const agg = aggregatedTransactions.find(
      (a) => a.aggregateKey === aggregateKey,
    )
    if (!agg) return

    setTransactions((prev) =>
      prev.map((trn) =>
        agg.transactionIds.includes(trn.id)
          ? { ...trn, editedPrice: value }
          : trn,
      ),
    )
    // aggregatedTransactions is a useMemo over transactions, so it recomputes
    // automatically — no separate aggregated-state update needed.
  }

  const handleAggregatedStatusChange = (
    aggregateKey: string,
    value: TrnStatus,
  ): void => {
    const agg = aggregatedTransactions.find(
      (a) => a.aggregateKey === aggregateKey,
    )
    if (!agg) return

    const updates: Partial<ProposedTransaction> = { editedStatus: value }
    if (value === "SETTLED") {
      updates.editedTradeDate = getToday()
    }

    setTransactions((prev) =>
      prev.map((trn) =>
        agg.transactionIds.includes(trn.id) ? { ...trn, ...updates } : trn,
      ),
    )
    // aggregatedTransactions recomputes from transactions via useMemo.
  }

  const handleAggregatedTradeDateChange = (
    aggregateKey: string,
    value: string,
  ): void => {
    const agg = aggregatedTransactions.find(
      (a) => a.aggregateKey === aggregateKey,
    )
    if (!agg) return

    setTransactions((prev) =>
      prev.map((trn) =>
        agg.transactionIds.includes(trn.id)
          ? { ...trn, editedTradeDate: value }
          : trn,
      ),
    )
    // aggregatedTransactions recomputes from transactions via useMemo.
  }

  // Selection handlers for aggregated view
  const handleSelectAggregated = (
    aggregateKey: string,
    checked: boolean,
  ): void => {
    const agg = aggregatedTransactions.find(
      (a) => a.aggregateKey === aggregateKey,
    )
    if (!agg) return

    // Only select PROPOSED transactions
    const proposedIds = agg.transactions
      .filter((t) => t.status === "PROPOSED")
      .map((t) => t.id)

    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        proposedIds.forEach((id) => next.add(id))
      } else {
        proposedIds.forEach((id) => next.delete(id))
      }
      return next
    })
  }

  const handleDeleteConfirm = async (): Promise<void> => {
    if (!deleteTargetId) return
    const id = deleteTargetId
    setDeleteTargetId(null)

    try {
      const response = await fetch(`/api/trns/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        setError(`Failed to delete transaction: ${response.statusText}`)
        return
      }

      // Remove from local state and invalidate every /api/trns/proposed* key
      // (covers all scopes plus the /count badge).
      setTransactions((prev) => prev.filter((t) => t.id !== id))
      mutate(
        (key) =>
          typeof key === "string" && key.startsWith("/api/trns/proposed"),
      )
    } catch (err) {
      console.error("Error deleting transaction:", err)
      setError(
        err instanceof Error ? err.message : "Failed to delete transaction",
      )
    }
  }

  // Selection handlers
  const proposedTransactions = transactions.filter(
    (trn) => trn.status === "PROPOSED",
  )
  const selectedProposed = proposedTransactions.filter((trn) =>
    selectedIds.has(trn.id),
  )
  const selectedSettled = transactions.filter(
    (trn) => trn.status === "SETTLED" && selectedIds.has(trn.id),
  )
  const allProposedSelected =
    proposedTransactions.length > 0 &&
    proposedTransactions.every((trn) => selectedIds.has(trn.id))
  const someProposedSelected =
    selectedProposed.length > 0 && !allProposedSelected

  const handleSelectAll = (): void => {
    if (allProposedSelected) {
      // Deselect all
      setSelectedIds(new Set())
    } else {
      // Select all proposed transactions
      setSelectedIds(new Set(proposedTransactions.map((trn) => trn.id)))
    }
  }

  const handleSelectOne = (id: string, checked: boolean): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }

  const handleSettleSelected = async (): Promise<void> => {
    if (selectedProposed.length === 0) return

    setIsSettling(true)
    setError(null)

    try {
      // Group by portfolio
      const byPortfolio = new Map<string, string[]>()
      selectedProposed.forEach((trn) => {
        const ids = byPortfolio.get(trn.portfolio.id) || []
        ids.push(trn.id)
        byPortfolio.set(trn.portfolio.id, ids)
      })

      // Settle each portfolio's transactions
      for (const [portfolioId, trnIds] of byPortfolio) {
        const response = await fetch(
          `/api/trns/portfolio/${portfolioId}/settle`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ trnIds }),
          },
        )

        if (!response.ok) {
          setError(`Failed to settle: ${response.statusText}`)
          setIsSettling(false)
          return
        }
      }

      // Refresh and clear selection
      mutate(proposedKey)
      mutate("/api/trns/proposed/count")
      setSelectedIds(new Set())
    } catch (err) {
      console.error("Error settling transactions:", err)
      setError(
        err instanceof Error ? err.message : "Failed to settle transactions",
      )
    } finally {
      setIsSettling(false)
    }
  }

  const handleUnsettleSelected = async (): Promise<void> => {
    if (selectedSettled.length === 0) return

    setIsUnsettling(true)
    setError(null)

    try {
      // Group selected SETTLED transactions by portfolio
      const byPortfolio = new Map<string, string[]>()
      selectedSettled.forEach((trn) => {
        const ids = byPortfolio.get(trn.portfolio.id) || []
        ids.push(trn.id)
        byPortfolio.set(trn.portfolio.id, ids)
      })

      // Unsettle each portfolio's transactions. The server cascade-deletes each
      // trade's auto-emitted cash legs.
      for (const [portfolioId, trnIds] of byPortfolio) {
        const response = await fetch(
          `/api/trns/portfolio/${portfolioId}/unsettle`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ trnIds }),
          },
        )

        if (!response.ok) {
          setError(`Failed to unsettle: ${response.statusText}`)
          setIsUnsettling(false)
          return
        }
      }

      // Refresh and clear selection
      mutate(proposedKey)
      mutate("/api/trns/proposed/count")
      setSelectedIds(new Set())
    } catch (err) {
      console.error("Error unsettling transactions:", err)
      setError(
        err instanceof Error ? err.message : "Failed to unsettle transactions",
      )
    } finally {
      setIsUnsettling(false)
    }
  }

  const hasChanges = (trn: ProposedTransaction): boolean =>
    trn.editedPrice !== trn.price ||
    trn.editedFees !== trn.fees ||
    trn.editedStatus !== trn.status ||
    trn.editedTradeDate !== trn.tradeDate ||
    trn.editedBrokerId !== trn.broker?.id

  const hasAnyUnsavedChanges = (): boolean =>
    transactions.some((trn) => hasChanges(trn))

  const handleEdit = (portfolioId: string, trnId: string): void => {
    if (hasAnyUnsavedChanges()) {
      setEditTarget({ portfolioId, trnId })
      return
    }
    router.push(`/trns/trades/edit/${portfolioId}/${trnId}`)
  }

  const saveTransaction = async (
    trn: ProposedTransaction,
  ): Promise<boolean> => {
    if (!hasChanges(trn)) return true

    try {
      const response = await fetch(
        `/api/trns/patch/${trn.portfolio.id}/${trn.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assetId: trn.asset.id,
            trnType: trn.trnType,
            quantity: trn.quantity,
            tradeCurrency: trn.tradeCurrency.code,
            price: trn.editedPrice,
            fees: trn.editedFees,
            status: trn.editedStatus,
            tradeDate: trn.editedTradeDate,
            tradeAmount: calculateTradeAmount(
              trn.quantity,
              trn.editedPrice || trn.price,
              0,
              trn.editedFees || 0,
              trn.trnType,
            ),
            brokerId: trn.editedBrokerId,
          }),
        },
      )

      if (!response.ok) {
        console.error(`Failed to update transaction: ${response.statusText}`)
        return false
      }
      return true
    } catch (err) {
      console.error("Error saving transaction:", err)
      return false
    }
  }

  const handleSave = async (): Promise<void> => {
    setIsSaving(true)
    setError(null)

    const editedTransactions = transactions.filter(hasChanges)
    const results = await Promise.all(editedTransactions.map(saveTransaction))

    if (results.every((r) => r)) {
      // Refresh the data and badge count
      mutate(proposedKey)
      mutate("/api/trns/proposed/count")
    } else {
      setError("Some transactions failed to save")
    }

    setIsSaving(false)
  }

  const anyChanges = transactions.some(hasChanges)

  if (userLoading) {
    return rootLoader("Loading...")
  }

  return (
    <>
      <Head>
        <title>Review Proposed Transactions</title>
      </Head>

      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <h1 className="text-2xl font-bold mb-6">
          Review Proposed Transactions
        </h1>

        <p className="text-gray-600 mb-4">
          These transactions are pending review. Change status to SETTLED to
          include them in your holdings calculations.
        </p>

        {/* Collapsible filter toolbar — collapsed by default on mobile to cut
            scrolling; a one-line summary keeps the active filters visible while
            collapsed. Sections are labelled so each control's purpose is clear. */}
        <div className="mb-6">
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            aria-expanded={filtersOpen}
            aria-controls="trn-filters"
            className={`flex w-full items-center justify-between gap-3 border border-gray-200 bg-gray-50 px-3 py-2 text-left sm:px-4 ${
              filtersOpen ? "rounded-t-lg" : "rounded-lg"
            }`}
          >
            <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <i
                className="fas fa-sliders-h text-gray-400"
                aria-hidden="true"
              />
              Filters
            </span>
            <span className="flex min-w-0 items-center gap-2">
              {!filtersOpen && (
                <span className="truncate text-xs text-gray-500">
                  {scope === "ALL"
                    ? "All"
                    : scope === "OWNED"
                      ? "Mine"
                      : "Managed"}
                  {` · ${fromDate} → ${toDate}`}
                  {includeSettled ? " · +settled" : ""}
                  {typeFilter !== "ALL" ? ` · ${typeFilter}` : ""}
                  {brokerFilter !== "ALL"
                    ? ` · ${
                        brokers.find((b) => b.id === brokerFilter)?.name ??
                        "broker"
                      }`
                    : ""}
                  {aggregateView ? " · aggregated" : ""}
                </span>
              )}
              <i
                className={`fas fa-chevron-${filtersOpen ? "up" : "down"} text-gray-400`}
                aria-hidden="true"
              />
            </span>
          </button>
          {filtersOpen && (
            <div
              id="trn-filters"
              className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end gap-x-6 bg-gray-50 p-3 sm:p-4 rounded-b-lg border border-t-0 border-gray-200"
            >
              {/* Scope */}
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Scope
                </span>
                <div
                  role="group"
                  aria-label="Scope"
                  className="inline-flex rounded-md border border-gray-300 overflow-hidden text-sm self-start"
                >
                  {(["ALL", "OWNED", "MANAGED"] as ProposedScope[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setScope(s)}
                      className={`px-3 py-1 ${
                        scope === s
                          ? "bg-invest-600 text-white"
                          : "bg-white text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      {s === "ALL" ? "All" : s === "OWNED" ? "Mine" : "Managed"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date range — one window for everything on the page */}
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Date range
                </span>
                <div className="flex items-center gap-2 text-sm">
                  <DateInput
                    value={fromDate}
                    onChange={setFromDate}
                    max={toDate}
                    className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-gray-400">→</span>
                  <DateInput
                    value={toDate}
                    onChange={setToDate}
                    min={fromDate}
                    className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setFromDate(defaultFrom())
                      setToDate(defaultTo())
                    }}
                    className="text-xs text-blue-600 hover:underline"
                    title="Reset to yesterday → tomorrow"
                  >
                    Reset
                  </button>
                </div>
                <span className="text-xs text-gray-400">
                  Proposed due on/before end · settled within range
                </span>
              </div>

              {/* Settled */}
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Settled
                </span>
                <label className="flex h-[30px] items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={includeSettled}
                    onChange={(e) => setIncludeSettled(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">Include settled</span>
                  {includeSettled && (
                    <span className="text-xs text-gray-500">
                      {settledLoading
                        ? "(loading…)"
                        : `(${settledTransactions.length})`}
                    </span>
                  )}
                </label>
              </div>

              {/* Type */}
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Type
                </span>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="h-[30px] px-2 py-1 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="ALL">ALL</option>
                  <option value="DIVI">DIVI</option>
                  <option value="SPLIT">SPLIT</option>
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                  <option value="ADD">ADD</option>
                  <option value="REDUCE">REDUCE</option>
                </select>
              </div>

              {/* View */}
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  View
                </span>
                <label className="flex h-[30px] items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={aggregateView}
                    onChange={(e) => setAggregateView(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">
                    Aggregate by broker + asset
                  </span>
                </label>
              </div>

              {/* Broker — display-only filter; does not edit transactions */}
              {brokers.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Broker
                  </span>
                  <select
                    aria-label="Broker filter"
                    value={brokerFilter}
                    onChange={(e) => setBrokerFilter(e.target.value)}
                    className="h-[30px] px-2 py-1 border border-gray-300 rounded text-sm bg-white"
                  >
                    <option value="ALL">ALL</option>
                    {brokers.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                        {b.accountNumber ? ` (${b.accountNumber})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {fetchError && (
          <div className="mb-4">
            <Alert>Failed to load proposed transactions</Alert>
          </div>
        )}

        {settledError && (
          <div className="mb-4">
            <Alert>Failed to load settled transactions</Alert>
          </div>
        )}

        {error && (
          <div className="mb-4">
            <Alert>{error}</Alert>
          </div>
        )}

        {!fetchError && transactions.length === 0 && (
          <div className="bg-gray-50 border border-gray-200 text-gray-600 px-4 py-8 rounded text-center">
            {solePortfolio ? (
              <div className="space-y-3">
                <p>{"No proposed transactions — you're all caught up."}</p>
                <button
                  onClick={() => router.push(`/holdings/${solePortfolio.code}`)}
                  className="btn-primary btn-primary--sm"
                >
                  {`View ${solePortfolio.name} holdings`}
                </button>
              </div>
            ) : (
              "No proposed transactions found. All caught up!"
            )}
          </div>
        )}

        {transactions.length > 0 && (
          <>
            {/* Action Bar */}
            <div className="flex flex-wrap items-center gap-3 mb-4 bg-gray-50 p-3 sm:p-4 rounded-lg">
              <button
                onClick={handleSettleSelected}
                disabled={selectedProposed.length === 0 || isSettling}
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {isSettling
                  ? "Settling..."
                  : `Settle Selected (${selectedProposed.length})`}
              </button>
              {selectedSettled.length > 0 && (
                <button
                  onClick={handleUnsettleSelected}
                  disabled={isUnsettling}
                  className="px-4 py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {isUnsettling
                    ? "Unsettling..."
                    : `Unsettle Selected (${selectedSettled.length})`}
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={!anyChanges || isSaving}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
              {anyChanges && (
                <span className="text-sm text-gray-500">
                  You have unsaved changes
                </span>
              )}
            </div>

            {/* Transactions Table - Detailed View */}
            {!aggregateView && (
              <div className="-mx-4 sm:mx-0 overflow-x-auto">
                <DetailedTransactionsTable
                  transactions={transactions}
                  brokers={brokers}
                  selectedIds={selectedIds}
                  allProposedSelected={allProposedSelected}
                  someProposedSelected={someProposedSelected}
                  onSelectAll={handleSelectAll}
                  onSelectOne={handleSelectOne}
                  onPriceChange={handlePriceChange}
                  onFeesChange={handleFeesChange}
                  onStatusChange={handleStatusChange}
                  onTradeDateChange={handleTradeDateChange}
                  onBrokerChange={handleBrokerChange}
                  onEdit={handleEdit}
                  onDelete={setDeleteTargetId}
                />
              </div>
            )}

            {/* Transactions Table - Aggregated View */}
            {aggregateView && (
              <div className="-mx-4 sm:mx-0 overflow-x-auto">
                <AggregatedTransactionsTable
                  aggregatedTransactions={aggregatedTransactions}
                  selectedIds={selectedIds}
                  onSelectAggregated={handleSelectAggregated}
                  onPriceChange={handleAggregatedPriceChange}
                  onStatusChange={handleAggregatedStatusChange}
                  onTradeDateChange={handleAggregatedTradeDateChange}
                />
              </div>
            )}

            {/* Summary */}
            <div className="mt-4 bg-gray-50 p-3 sm:p-4 rounded-lg">
              {(() => {
                const totals = transactions.reduce(
                  (acc, t) => {
                    const amt = calculateTradeAmount(
                      t.quantity,
                      t.editedPrice || t.price,
                      0,
                      t.editedFees || 0,
                      t.trnType,
                    )
                    if (t.trnType === "SELL") acc.sales += amt
                    else if (t.trnType === "BUY") acc.purchases += amt
                    acc.fees += t.editedFees || 0
                    return acc
                  },
                  { sales: 0, purchases: 0, fees: 0 },
                )
                const balance = totals.sales - totals.purchases
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-3 text-sm">
                    <div>
                      <div className="text-gray-500">
                        {aggregateView
                          ? "Aggregated Groups"
                          : "Total Transactions"}
                      </div>
                      <div className="font-semibold">
                        {aggregateView
                          ? aggregatedTransactions.length
                          : transactions.length}
                      </div>
                      {aggregateView && (
                        <div className="text-xs text-gray-500">
                          ({transactions.length} underlying)
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-gray-500">Total Fees</div>
                      <div className="font-semibold font-mono tabular-nums">
                        {totals.fees.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">Sales</div>
                      <div className="font-semibold font-mono tabular-nums text-emerald-700">
                        {totals.sales.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">Purchases</div>
                      <div className="font-semibold font-mono tabular-nums text-red-700">
                        {totals.purchases.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">Balance</div>
                      <div
                        className={`font-semibold font-mono tabular-nums ${
                          balance >= 0 ? "text-emerald-700" : "text-red-700"
                        }`}
                      >
                        {balance.toFixed(2)}
                      </div>
                    </div>
                    {aggregateView && (
                      <div>
                        <div className="text-gray-500">Unique Assets</div>
                        <div className="font-semibold">
                          {
                            new Set(
                              aggregatedTransactions.map((a) => a.assetId),
                            ).size
                          }
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          </>
        )}
      </div>
      {deleteTargetId && (
        <ConfirmDialog
          title={"Delete Transaction"}
          message={"Delete this proposed transaction?"}
          confirmLabel={"Delete"}
          cancelLabel={"Cancel"}
          variant="red"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTargetId(null)}
        />
      )}
      {editTarget && (
        <ConfirmDialog
          title={"Unsaved Changes"}
          message={
            "You have unsaved changes. Opening the editor will lose these changes. Continue?"
          }
          confirmLabel={"Continue"}
          cancelLabel={"Cancel"}
          variant="amber"
          onConfirm={() => {
            const { portfolioId, trnId } = editTarget
            setEditTarget(null)
            router.push(`/trns/trades/edit/${portfolioId}/${trnId}`)
          }}
          onCancel={() => setEditTarget(null)}
        />
      )}
    </>
  )
}
