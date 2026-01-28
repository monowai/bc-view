import React, { useEffect, useMemo, useState } from "react"
import { GetServerSideProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { useTranslation } from "next-i18next"
import { useRouter } from "next/router"
import useSwr, { mutate } from "swr"
import { fetcher, simpleFetcher } from "@utils/api/fetchHelper"
import { rootLoader } from "@components/ui/PageLoader"
import { Broker, Transaction, TrnStatus } from "types/beancounter"
import Head from "next/head"
import { useUser } from "@auth0/nextjs-auth0/client"
import { calculateTradeAmount } from "@utils/trns/tradeUtils"

interface ProposedTransaction extends Transaction {
  editedPrice?: number
  editedFees?: number
  editedStatus?: TrnStatus
  editedTradeDate?: string
  editedBrokerId?: string
}

// Aggregated transaction for efficient execution view
interface AggregatedTransaction {
  aggregateKey: string // broker:asset key
  brokerId: string | undefined
  brokerName: string
  assetId: string
  assetCode: string
  assetName: string
  assetMarket: { code: string }
  trnType: string
  tradeCurrency: { code: string }
  totalQuantity: number
  avgPrice: number
  totalFees: number
  totalAmount: number
  transactionIds: string[]
  transactions: ProposedTransaction[]
  // Editable fields that apply to all underlying transactions
  editedPrice?: number
  editedFees?: number
  editedStatus?: TrnStatus
  editedTradeDate?: string
}

// Get today's date in YYYY-MM-DD format
const getToday = (): string => new Date().toISOString().split("T")[0]

// Get display code for an asset, stripping owner ID prefix for private assets
const getAssetDisplayCode = (asset: {
  code: string
  market: { code: string }
}): string => {
  if (asset.market.code === "PRIVATE" && asset.code.includes(".")) {
    return asset.code.split(".").slice(1).join(".")
  }
  return asset.code
}

export default function ProposedTransactions(): React.JSX.Element {
  const { t } = useTranslation("common")
  const { user, isLoading: userLoading } = useUser()
  const router = useRouter()

  const [transactions, setTransactions] = useState<ProposedTransaction[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [includeSettled, setIncludeSettled] = useState(false)
  const [settledDate, setSettledDate] = useState(getToday())
  const [settledTransactions, setSettledTransactions] = useState<Transaction[]>(
    [],
  )
  const [settledLoading, setSettledLoading] = useState(false)
  const [settledError, setSettledError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [typeFilter, setTypeFilter] = useState<string>("ALL")
  const [isSettling, setIsSettling] = useState(false)
  const [aggregateView, setAggregateView] = useState(false)
  const [aggregatedTransactions, setAggregatedTransactions] = useState<
    AggregatedTransaction[]
  >([])

  // Fetch proposed transactions across all portfolios
  const proposedKey = user ? "/api/trns/proposed" : null
  const { data: proposedData, error: fetchError } = useSwr<{
    data: Transaction[]
  }>(proposedKey, fetcher, { refreshInterval: 0 })

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
      setSettledTransactions([])
      return
    }

    const fetchSettled = async (): Promise<void> => {
      setSettledLoading(true)
      setSettledError(null)
      try {
        const response = await fetch(
          `/api/trns/settled?tradeDate=${settledDate}`,
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
  }, [includeSettled, settledDate])

  useEffect(() => {
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
    const filtered =
      typeFilter === "ALL"
        ? allTransactions
        : allTransactions.filter((trn) => trn.trnType === typeFilter)

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
    setTransactions(
      sorted.map((trn) => ({
        ...trn,
        editedPrice: trn.price,
        editedFees: trn.fees,
        editedStatus: trn.status,
        editedTradeDate: trn.tradeDate,
        editedBrokerId: trn.broker?.id || trn.brokerId,
      })),
    )
  }, [proposedData, settledTransactions, includeSettled, typeFilter])

  // Clear selection when filter changes
  useEffect(() => {
    setSelectedIds(new Set())
  }, [typeFilter, aggregateView])

  // Compute aggregated transactions when aggregate view is enabled
  useEffect(() => {
    if (!aggregateView) {
      setAggregatedTransactions([])
      return
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

    setAggregatedTransactions(aggregated)
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
    setAggregatedTransactions((prev) =>
      prev.map((a) =>
        a.aggregateKey === aggregateKey ? { ...a, editedPrice: value } : a,
      ),
    )
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
    setAggregatedTransactions((prev) =>
      prev.map((a) =>
        a.aggregateKey === aggregateKey
          ? {
              ...a,
              editedStatus: value,
              editedTradeDate:
                value === "SETTLED" ? getToday() : a.editedTradeDate,
            }
          : a,
      ),
    )
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
    setAggregatedTransactions((prev) =>
      prev.map((a) =>
        a.aggregateKey === aggregateKey ? { ...a, editedTradeDate: value } : a,
      ),
    )
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

  const isAggregatedSelected = (agg: AggregatedTransaction): boolean => {
    const proposedIds = agg.transactions
      .filter((t) => t.status === "PROPOSED")
      .map((t) => t.id)
    return (
      proposedIds.length > 0 && proposedIds.every((id) => selectedIds.has(id))
    )
  }

  const isAggregatedPartiallySelected = (
    agg: AggregatedTransaction,
  ): boolean => {
    const proposedIds = agg.transactions
      .filter((t) => t.status === "PROPOSED")
      .map((t) => t.id)
    const selectedCount = proposedIds.filter((id) => selectedIds.has(id)).length
    return selectedCount > 0 && selectedCount < proposedIds.length
  }

  const hasAggregatedProposed = (agg: AggregatedTransaction): boolean => {
    return agg.transactions.some((t) => t.status === "PROPOSED")
  }

  const handleDelete = async (id: string): Promise<void> => {
    if (!confirm("Delete this proposed transaction?")) return

    try {
      const response = await fetch(`/api/trns/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        setError(`Failed to delete transaction: ${response.statusText}`)
        return
      }

      // Remove from local state and update badge count
      setTransactions((prev) => prev.filter((t) => t.id !== id))
      mutate("/api/trns/proposed/count")
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
      if (
        !confirm(
          t(
            "trn.proposed.unsavedChanges",
            "You have unsaved changes. Opening the editor will lose these changes. Continue?",
          ),
        )
      ) {
        return
      }
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
    return rootLoader(t("loading"))
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

        {/* Filter options */}
        <div className="flex items-center gap-4 mb-6 bg-gray-50 p-3 rounded-lg flex-wrap">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-gray-700">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">ALL</option>
              <option value="DIVI">DIVI</option>
              <option value="SPLIT">SPLIT</option>
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
              <option value="ADD">ADD</option>
              <option value="REDUCE">REDUCE</option>
            </select>
          </label>
          <div className="border-l border-gray-300 h-6" />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeSettled}
              onChange={(e) => setIncludeSettled(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-gray-700">Include SETTLED on</span>
          </label>
          <input
            type="date"
            value={settledDate}
            onChange={(e) => setSettledDate(e.target.value)}
            disabled={!includeSettled}
            className={`px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 ${
              !includeSettled ? "bg-gray-100 text-gray-400" : ""
            }`}
          />
          {includeSettled && (
            <span className="text-xs text-gray-500">
              {settledLoading
                ? "(loading...)"
                : `(${settledTransactions.length} settled)`}
            </span>
          )}
          <div className="border-l border-gray-300 h-6" />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={aggregateView}
              onChange={(e) => setAggregateView(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-gray-700">Aggregate by Broker + Asset</span>
          </label>
        </div>

        {fetchError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            Failed to load proposed transactions
          </div>
        )}

        {settledError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            Failed to load settled transactions
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {!fetchError && transactions.length === 0 && (
          <div className="bg-gray-50 border border-gray-200 text-gray-600 px-4 py-8 rounded text-center">
            No proposed transactions found. All caught up!
          </div>
        )}

        {transactions.length > 0 && (
          <>
            {/* Action Bar */}
            <div className="flex items-center gap-4 mb-4 bg-gray-50 p-4 rounded-lg">
              <button
                onClick={handleSettleSelected}
                disabled={selectedProposed.length === 0 || isSettling}
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {isSettling
                  ? "Settling..."
                  : `Settle Selected (${selectedProposed.length})`}
              </button>
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
              <div className="overflow-x-auto bg-white rounded-lg shadow">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-2 text-center font-medium text-gray-500 uppercase w-10">
                        <input
                          type="checkbox"
                          checked={allProposedSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = someProposedSelected
                          }}
                          onChange={handleSelectAll}
                          className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                          title="Select all PROPOSED transactions"
                        />
                      </th>
                      <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">
                        Broker
                      </th>
                      <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">
                        Portfolio
                      </th>
                      <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">
                        Type
                      </th>
                      <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">
                        Asset
                      </th>
                      <th className="px-2 py-2 text-right font-medium text-gray-500 uppercase">
                        Qty
                      </th>
                      <th className="px-2 py-2 text-right font-medium text-gray-500 uppercase">
                        Price
                      </th>
                      <th className="px-2 py-2 text-right font-medium text-gray-500 uppercase">
                        Fees
                      </th>
                      <th className="px-2 py-2 text-right font-medium text-gray-500 uppercase">
                        Amount
                      </th>
                      <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">
                        Date
                      </th>
                      <th className="px-2 py-2 text-center font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {transactions.map((trn) => (
                      <tr key={trn.id} className="hover:bg-gray-50">
                        <td className="px-2 py-1.5 whitespace-nowrap text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(trn.id)}
                            onChange={(e) =>
                              handleSelectOne(trn.id, e.target.checked)
                            }
                            disabled={trn.status !== "PROPOSED"}
                            className="rounded border-gray-300 text-green-600 focus:ring-green-500 disabled:opacity-50"
                            title={
                              trn.status === "PROPOSED"
                                ? "Select for bulk settle"
                                : "Already settled"
                            }
                          />
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          <select
                            value={trn.editedBrokerId || ""}
                            onChange={(e) =>
                              handleBrokerChange(trn.id, e.target.value)
                            }
                            className="px-1 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-25"
                          >
                            <option value="">--</option>
                            {brokers.map((broker) => (
                              <option key={broker.id} value={broker.id}>
                                {broker.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          <span className="text-gray-600">
                            {trn.portfolio.code}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          <span
                            className={`px-1.5 py-0.5 font-medium rounded ${
                              trn.trnType === "DIVI"
                                ? "bg-blue-100 text-blue-800"
                                : trn.trnType === "BUY"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                            }`}
                          >
                            {trn.trnType}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          <div className="font-medium text-gray-900">
                            {getAssetDisplayCode(trn.asset)}
                          </div>
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap text-right font-mono">
                          {trn.quantity.toFixed(0)}
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap text-right">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={trn.editedPrice ?? ""}
                            onChange={(e) => {
                              const val = e.target.value
                              if (val === "" || /^[0-9]*\.?[0-9]*$/.test(val)) {
                                handlePriceChange(trn.id, parseFloat(val) || 0)
                              }
                            }}
                            onBlur={(e) => {
                              const val = parseFloat(e.target.value)
                              if (!isNaN(val)) {
                                handlePriceChange(trn.id, val)
                              }
                            }}
                            className="w-20 px-1 py-0.5 text-right border border-gray-300 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap text-right">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={trn.editedFees ?? ""}
                            onChange={(e) => {
                              const val = e.target.value
                              if (val === "" || /^[0-9]*\.?[0-9]*$/.test(val)) {
                                handleFeesChange(trn.id, parseFloat(val) || 0)
                              }
                            }}
                            onBlur={(e) => {
                              const val = parseFloat(e.target.value)
                              if (!isNaN(val)) {
                                handleFeesChange(trn.id, val)
                              }
                            }}
                            className="w-16 px-1 py-0.5 text-right border border-gray-300 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap text-right font-mono text-gray-600">
                          {calculateTradeAmount(
                            trn.quantity,
                            trn.editedPrice || trn.price,
                            0,
                            trn.editedFees || 0,
                            trn.trnType,
                          ).toFixed(2)}
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          <select
                            value={trn.editedStatus}
                            onChange={(e) =>
                              handleStatusChange(
                                trn.id,
                                e.target.value as TrnStatus,
                              )
                            }
                            className="px-1 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="PROPOSED">PROPOSED</option>
                            <option value="SETTLED">SETTLED</option>
                          </select>
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          <input
                            type="date"
                            value={trn.editedTradeDate || trn.tradeDate}
                            onChange={(e) =>
                              handleTradeDateChange(trn.id, e.target.value)
                            }
                            className="px-1 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap text-center">
                          <button
                            onClick={() => handleEdit(trn.portfolio.id, trn.id)}
                            className="text-blue-500 hover:text-blue-700 p-1 mr-1"
                            title="Edit transaction"
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                          <button
                            onClick={() => handleDelete(trn.id)}
                            className="text-red-500 hover:text-red-700 p-1"
                            title="Delete transaction"
                          >
                            <i className="fas fa-trash-alt"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Transactions Table - Aggregated View */}
            {aggregateView && (
              <div className="overflow-x-auto bg-white rounded-lg shadow">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-2 text-center font-medium text-gray-500 uppercase w-10">
                        <input
                          type="checkbox"
                          checked={
                            aggregatedTransactions.length > 0 &&
                            aggregatedTransactions
                              .filter(hasAggregatedProposed)
                              .every(isAggregatedSelected)
                          }
                          ref={(el) => {
                            if (el) {
                              const withProposed =
                                aggregatedTransactions.filter(
                                  hasAggregatedProposed,
                                )
                              const allSelected =
                                withProposed.every(isAggregatedSelected)
                              el.indeterminate =
                                withProposed.some(isAggregatedSelected) &&
                                !allSelected
                            }
                          }}
                          onChange={(e) => {
                            aggregatedTransactions.forEach((agg) => {
                              if (hasAggregatedProposed(agg)) {
                                handleSelectAggregated(
                                  agg.aggregateKey,
                                  e.target.checked,
                                )
                              }
                            })
                          }}
                          className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                          title="Select all PROPOSED transactions"
                        />
                      </th>
                      <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">
                        Broker
                      </th>
                      <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">
                        Type
                      </th>
                      <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">
                        Asset
                      </th>
                      <th className="px-2 py-2 text-right font-medium text-gray-500 uppercase">
                        Total Qty
                      </th>
                      <th className="px-2 py-2 text-right font-medium text-gray-500 uppercase">
                        Price
                      </th>
                      <th className="px-2 py-2 text-right font-medium text-gray-500 uppercase">
                        Total Fees
                      </th>
                      <th className="px-2 py-2 text-right font-medium text-gray-500 uppercase">
                        Total Amount
                      </th>
                      <th className="px-2 py-2 text-right font-medium text-gray-500 uppercase">
                        Weight
                      </th>
                      <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">
                        Date
                      </th>
                      <th className="px-2 py-2 text-center font-medium text-gray-500 uppercase">
                        Trns
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(() => {
                      const grandTotal = aggregatedTransactions.reduce(
                        (sum, a) => sum + Math.abs(a.totalAmount),
                        0,
                      )
                      return aggregatedTransactions.map((agg) => {
                        const weight =
                          grandTotal > 0
                            ? (Math.abs(agg.totalAmount) / grandTotal) * 100
                            : 0
                        return (
                          <tr
                            key={agg.aggregateKey}
                            className={`hover:bg-gray-50 ${
                              agg.trnType === "BUY"
                                ? "bg-green-50"
                                : agg.trnType === "SELL"
                                  ? "bg-red-50"
                                  : ""
                            }`}
                          >
                            <td className="px-2 py-1.5 whitespace-nowrap text-center">
                              <input
                                type="checkbox"
                                checked={isAggregatedSelected(agg)}
                                ref={(el) => {
                                  if (el)
                                    el.indeterminate =
                                      isAggregatedPartiallySelected(agg)
                                }}
                                onChange={(e) =>
                                  handleSelectAggregated(
                                    agg.aggregateKey,
                                    e.target.checked,
                                  )
                                }
                                disabled={!hasAggregatedProposed(agg)}
                                className="rounded border-gray-300 text-green-600 focus:ring-green-500 disabled:opacity-50"
                                title={
                                  hasAggregatedProposed(agg)
                                    ? `Select ${agg.transactions.filter((t) => t.status === "PROPOSED").length} transactions for bulk settle`
                                    : "All transactions already settled"
                                }
                              />
                            </td>
                            <td className="px-2 py-1.5 whitespace-nowrap">
                              <span className="text-gray-700 font-medium">
                                {agg.brokerName || "--"}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 whitespace-nowrap">
                              <span
                                className={`px-1.5 py-0.5 font-medium rounded ${
                                  agg.trnType === "DIVI"
                                    ? "bg-blue-100 text-blue-800"
                                    : agg.trnType === "BUY"
                                      ? "bg-green-100 text-green-800"
                                      : "bg-red-100 text-red-800"
                                }`}
                              >
                                {agg.trnType}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 whitespace-nowrap">
                              <div className="font-medium text-gray-900">
                                {agg.assetCode}
                              </div>
                              <div className="text-xs text-gray-500 truncate max-w-32">
                                {agg.assetName}
                              </div>
                            </td>
                            <td className="px-2 py-1.5 whitespace-nowrap text-right font-mono font-semibold">
                              {agg.totalQuantity.toFixed(0)}
                            </td>
                            <td className="px-2 py-1.5 whitespace-nowrap text-right">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={agg.editedPrice ?? ""}
                                onChange={(e) => {
                                  const val = e.target.value
                                  if (val === "" || /^[0-9]*\.?[0-9]*$/.test(val)) {
                                    handleAggregatedPriceChange(
                                      agg.aggregateKey,
                                      parseFloat(val) || 0,
                                    )
                                  }
                                }}
                                onBlur={(e) => {
                                  const val = parseFloat(e.target.value)
                                  if (!isNaN(val)) {
                                    handleAggregatedPriceChange(agg.aggregateKey, val)
                                  }
                                }}
                                className="w-20 px-1 py-0.5 text-right border border-gray-300 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                                title="Editing price updates all underlying transactions"
                              />
                            </td>
                            <td className="px-2 py-1.5 whitespace-nowrap text-right font-mono text-gray-600">
                              {agg.totalFees.toFixed(2)}
                            </td>
                            <td className="px-2 py-1.5 whitespace-nowrap text-right font-mono font-semibold">
                              {agg.totalAmount.toFixed(2)}
                            </td>
                            <td className="px-2 py-1.5 whitespace-nowrap text-right font-mono text-gray-600">
                              {weight.toFixed(1)}%
                            </td>
                            <td className="px-2 py-1.5 whitespace-nowrap">
                              <select
                                value={agg.editedStatus || "PROPOSED"}
                                onChange={(e) =>
                                  handleAggregatedStatusChange(
                                    agg.aggregateKey,
                                    e.target.value as TrnStatus,
                                  )
                                }
                                className="px-1 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                title="Changing status updates all underlying transactions"
                              >
                                <option value="PROPOSED">PROPOSED</option>
                                <option value="SETTLED">SETTLED</option>
                              </select>
                            </td>
                            <td className="px-2 py-1.5 whitespace-nowrap">
                              <input
                                type="date"
                                value={agg.editedTradeDate || getToday()}
                                onChange={(e) =>
                                  handleAggregatedTradeDateChange(
                                    agg.aggregateKey,
                                    e.target.value,
                                  )
                                }
                                className="px-1 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                title="Changing date updates all underlying transactions"
                              />
                            </td>
                            <td className="px-2 py-1.5 whitespace-nowrap text-center">
                              <span
                                className="inline-flex items-center justify-center w-6 h-6 text-xs font-medium bg-gray-200 text-gray-700 rounded-full"
                                title={`${agg.transactionIds.length} underlying transactions`}
                              >
                                {agg.transactionIds.length}
                              </span>
                            </td>
                          </tr>
                        )
                      })
                    })()}
                  </tbody>
                </table>
              </div>
            )}

            {/* Summary */}
            <div className="mt-4 bg-gray-50 p-4 rounded-lg">
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">
                    {aggregateView ? "Aggregated Groups" : "Total Transactions"}
                  </div>
                  <div className="font-semibold">
                    {aggregateView
                      ? aggregatedTransactions.length
                      : transactions.length}
                  </div>
                  {aggregateView && (
                    <div className="text-xs text-gray-400">
                      ({transactions.length} underlying)
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-gray-500">Total Fees</div>
                  <div className="font-semibold font-mono">
                    {transactions
                      .reduce((sum, t) => sum + (t.editedFees || 0), 0)
                      .toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Total Amount</div>
                  <div className="font-semibold font-mono">
                    {transactions
                      .reduce(
                        (sum, t) =>
                          sum +
                          calculateTradeAmount(
                            t.quantity,
                            t.editedPrice || t.price,
                            0,
                            t.editedFees || 0,
                            t.trnType,
                          ),
                        0,
                      )
                      .toFixed(2)}
                  </div>
                </div>
                {aggregateView && (
                  <div>
                    <div className="text-gray-500">Unique Assets</div>
                    <div className="font-semibold">
                      {
                        new Set(aggregatedTransactions.map((a) => a.assetId))
                          .size
                      }
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common"])),
  },
})
