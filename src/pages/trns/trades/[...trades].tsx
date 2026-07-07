import React, { useState, useEffect, useMemo, useCallback } from "react"
import { NumericFormat } from "react-number-format"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { useRouter } from "next/router"
import Link from "next/link"
import {
  assetKey,
  simpleFetcher,
  tradeKey,
  tradeKeyMulti,
  trnKey,
  holdingKey,
} from "@utils/api/fetchHelper"
import { Transaction, TrnTradeSummary } from "types/beancounter"
import ConfirmDialog from "@components/ui/ConfirmDialog"
import { rootLoader } from "@components/ui/PageLoader"
import { errorOut } from "@components/errors/ErrorOut"
import useSwr, { mutate } from "swr"
import { getDisplayCode } from "@lib/assets/assetUtils"
import FxEditModal from "@components/features/transactions/FxEditModal"
import SubAccountTrnEditModal from "@components/features/transactions/SubAccountTrnEditModal"
import TradeInputForm from "@components/features/transactions/TradeInputForm"
import { unsettleTrn } from "@utils/trns/apiHelper"
import { buildTradeGroups } from "@utils/trns/tradeUtils"
import { holdingsHighlightHref } from "@utils/holdings/holdingsHref"

export default withPageAuthRequired(function Trades(): React.ReactElement {
  const router = useRouter()
  const [editModalOpen, setEditModalOpen] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [unsettleError, setUnsettleError] = useState<string | null>(null)
  const [listDeleteTarget, setListDeleteTarget] = useState<{
    id: string
    portfolioCode: string
  } | null>(null)

  // Extract query params - safe to access even before router is ready (will be undefined)
  const tradesParam = router.query.trades as string[] | undefined

  // Detect if this is an edit request: /trns/trades/edit/[portfolioId]/[trnId]
  const isEditMode = tradesParam && tradesParam[0] === "edit"

  // Aggregated drill-down: /trns/trades/[assetId]?portfolios=a,b — one asset
  // held in several portfolios, grouped by portfolio instead of broker.
  // router.query gives string[] when the param repeats — normalise to a string.
  const portfoliosQuery = router.query.portfolios
  const portfoliosParam = Array.isArray(portfoliosQuery)
    ? portfoliosQuery.join(",")
    : portfoliosQuery
  const isMulti = !isEditMode && !!portfoliosParam
  const portfolioIds = useMemo(
    () => (portfoliosParam ? portfoliosParam.split(",").filter(Boolean) : []),
    [portfoliosParam],
  )

  // For edit mode: trades[1] = portfolioId, trades[2] = trnId
  // For single-portfolio list mode: trades[0] = portfolioId, trades[1] = assetId
  // For aggregated mode: trades[0] = assetId (portfolios come from the query)
  const portfolioId = isEditMode
    ? tradesParam![1]
    : isMulti
      ? undefined
      : tradesParam
        ? tradesParam[0]
        : undefined
  const assetId = isMulti
    ? tradesParam?.[0]
    : tradesParam
      ? tradesParam[1]
      : undefined
  const trnId = isEditMode ? tradesParam![2] : undefined

  // Reset modal state when entering edit mode with a new transaction
  useEffect(() => {
    if (isEditMode && trnId) {
      setEditModalOpen(true)
    }
  }, [isEditMode, trnId])

  // Fetch single transaction for edit mode - always fetch fresh from backend
  // Only fetch when router is ready and we have valid params
  const singleTrn = useSwr(
    router.isReady && isEditMode && trnId ? trnKey(trnId as string) : null,
    router.isReady && isEditMode && trnId
      ? simpleFetcher(trnKey(trnId as string))
      : null,
    {
      revalidateOnFocus: false,
      revalidateOnMount: true,
      revalidateIfStale: true,
      dedupingInterval: 0, // Disable deduplication to always fetch fresh
    },
  )

  // Fetch asset and trades for list mode
  const asset = useSwr(
    router.isReady && !isEditMode && assetId
      ? assetKey(assetId as string)
      : null,
    router.isReady && !isEditMode && assetId
      ? simpleFetcher(assetKey(assetId as string))
      : null,
  )
  const tradesUrl =
    router.isReady && !isEditMode && assetId
      ? isMulti
        ? portfolioIds.length > 0
          ? tradeKeyMulti(assetId as string, portfolioIds)
          : null
        : portfolioId
          ? tradeKey(portfolioId as string, assetId as string)
          : null
      : null
  const trades = useSwr(tradesUrl, tradesUrl ? simpleFetcher(tradesUrl) : null)

  // Group transactions by broker (must be called before any early returns for hooks rules)
  const trnResults = useMemo(
    (): Transaction[] => trades.data?.data || [],
    [trades.data?.data],
  )
  // Single-portfolio view groups by broker. The aggregated drill-down groups by
  // portfolio AND broker (one asset held across several portfolios, each split
  // over several brokers) so a broker's slice is never hidden inside a portfolio
  // that happens to share a broker's name. Split-adjusted quantities come from
  // the server summary (see buildTradeGroups / TrnTradeSummaryBuilder).
  const groups = useMemo(
    () =>
      buildTradeGroups(
        trnResults,
        isMulti,
        trades.data?.summary as TrnTradeSummary | undefined,
      ),
    [trnResults, isMulti, trades.data?.summary],
  )

  // Group header label. The aggregated (multi-portfolio) view shows the
  // portfolio code — linked to that portfolio's holdings with the drilled-down
  // asset highlighted — alongside a broker badge, so one asset split across
  // brokers within a portfolio is visible. The single-portfolio view shows the
  // broker name only.
  const renderGroupLabel = (group: {
    label: string
    portfolioCode?: string
    transactions: Transaction[]
  }): React.ReactElement => {
    if (isMulti) {
      const pCode = group.portfolioCode ?? group.label
      const isNamedPortfolio = !!group.portfolioCode
      const brokerBadge = (
        <span className="ml-2 inline-flex items-center rounded bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
          <i className="fas fa-university mr-1"></i>
          {group.label}
        </span>
      )
      const portfolio = (
        <>
          <i className="fas fa-building mr-2 text-indigo-400"></i>
          {pCode}
        </>
      )
      return (
        <span className="flex items-center font-medium text-indigo-900">
          {assetId && isNamedPortfolio ? (
            <Link
              href={holdingsHighlightHref(pCode, assetId as string)}
              className="hover:text-indigo-700 hover:underline"
              title={`View ${pCode} holdings`}
            >
              {portfolio}
            </Link>
          ) : (
            <span>{portfolio}</span>
          )}
          {brokerBadge}
        </span>
      )
    }
    return (
      <span className="font-medium text-indigo-900">
        {/* Single-portfolio groups are brokers, so carry the broker icon. */}
        <i
          className="fas fa-university mr-2 text-indigo-400"
          title="Broker"
        ></i>
        {group.label}
      </span>
    )
  }

  // Copy row data to clipboard as tab-separated values
  const copyRowToClipboard = useCallback(
    (trn: Transaction, e: React.MouseEvent) => {
      e.stopPropagation()
      const row = [
        trn.tradeDate,
        trn.trnType,
        getDisplayCode(trn.asset),
        trn.tradeCurrency.code,
        trn.quantity?.toFixed(2) || "",
        trn.price?.toFixed(2) || "",
        trn.tradeAmount?.toFixed(2) || "",
        trn.cashAmount?.toFixed(2) || "",
      ].join("\t")
      navigator.clipboard.writeText(row)
    },
    [],
  )

  // Delete transaction from list mode
  const handleListDeleteConfirm = useCallback(async (): Promise<void> => {
    if (!listDeleteTarget) return
    try {
      const response = await fetch(`/api/trns/trades/${listDeleteTarget.id}`, {
        method: "DELETE",
      })
      if (response.ok) {
        setTimeout(() => {
          mutate(holdingKey(listDeleteTarget.portfolioCode, "today"))
          trades.mutate()
        }, 1500)
      }
    } catch (err) {
      console.error("Error deleting transaction:", err)
    } finally {
      setListDeleteTarget(null)
    }
  }, [listDeleteTarget, trades])

  // Wait for router to be ready (query params available) during client-side navigation
  if (!router.isReady) {
    return rootLoader("Loading...")
  }

  // Handle edit mode
  if (isEditMode) {
    if (singleTrn.error) {
      return errorOut("Error retrieving trades", singleTrn.error)
    }
    if (singleTrn.isLoading) {
      return rootLoader("Loading...")
    }
    // API returns an array, get the first transaction
    const transaction = Array.isArray(singleTrn.data?.data)
      ? singleTrn.data.data[0]
      : singleTrn.data?.data

    if (!transaction) {
      return (
        <div id="root" className="text-center py-8">
          <p className="text-gray-500 mb-4">{"No transactions found"}</p>
          <button
            onClick={() => router.back()}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300 transition-colors"
          >
            <i className="fa fa-arrow-left mr-2"></i>
            {"Back"}
          </button>
        </div>
      )
    }

    const handleClose = (): void => {
      setEditModalOpen(false)
      router.back()
    }

    const handleDeleteConfirm = async (): Promise<void> => {
      setShowDeleteConfirm(false)
      try {
        const response = await fetch(`/api/trns/trades/${transaction.id}`, {
          method: "DELETE",
        })
        if (response.ok) {
          // Invalidate holdings cache after delete (with delay for message broker)
          setTimeout(() => {
            mutate(holdingKey(transaction.portfolio.code, "today"))
            mutate("/api/holdings/aggregated?asAt=today")
          }, 1500)
          router.back()
        }
      } catch (err) {
        console.error("Error deleting transaction:", err)
      }
    }

    const handleUnsettle = async (): Promise<void> => {
      setUnsettleError(null)
      try {
        const response = await unsettleTrn(transaction.id)
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          setUnsettleError(
            errorData.detail ||
              errorData.message ||
              `Failed to unsettle: ${response.statusText}`,
          )
          return
        }
        // The server cascade-deletes the auto-emitted cash legs on unsettle, so
        // there is nothing for the user to confirm. Invalidate holdings so the row
        // reflects the new PROPOSED status, then close.
        setTimeout(() => {
          mutate(holdingKey(transaction.portfolio.code, "today"))
          mutate("/api/holdings/aggregated?asAt=today")
        }, 1500)
        router.back()
      } catch (err) {
        console.error("Error unsettling transaction:", err)
        setUnsettleError(
          err instanceof Error ? err.message : "Failed to unsettle",
        )
      }
    }

    // Use FxEditModal for FX transactions (FX, FX_BUY, FX_SELL)
    const isFxType =
      transaction.trnType === "FX" || transaction.trnType.startsWith("FX_")

    // Composite-policy trns (e.g. CPF) carry a per-sub-account split; edit them
    // with the same bucket data-entry display as "set balance".
    const hasSubAccounts =
      !!transaction.subAccounts &&
      Object.keys(transaction.subAccounts).length > 0

    return (
      <>
        {editModalOpen ? (
          hasSubAccounts ? (
            <SubAccountTrnEditModal
              trn={transaction}
              onClose={handleClose}
              onDelete={() => setShowDeleteConfirm(true)}
            />
          ) : isFxType ? (
            <FxEditModal
              trn={transaction}
              onClose={handleClose}
              onDelete={() => setShowDeleteConfirm(true)}
            />
          ) : (
            <TradeInputForm
              portfolio={transaction.portfolio}
              modalOpen={editModalOpen}
              setModalOpen={(open) => {
                if (!open) handleClose()
              }}
              editMode={{
                transaction,
                onClose: handleClose,
                onDelete: () => setShowDeleteConfirm(true),
                onUnsettle: handleUnsettle,
              }}
            />
          )
        ) : null}
        {showDeleteConfirm && (
          <ConfirmDialog
            title={"Delete Transaction"}
            message={"Permanently delete this transaction?"}
            confirmLabel={"Delete"}
            cancelLabel={"Cancel"}
            variant="red"
            onConfirm={handleDeleteConfirm}
            onCancel={() => setShowDeleteConfirm(false)}
          />
        )}
        {unsettleError && (
          <ConfirmDialog
            title={"Unsettle failed"}
            message={unsettleError}
            confirmLabel={"OK"}
            cancelLabel={"Dismiss"}
            variant="amber"
            onConfirm={() => setUnsettleError(null)}
            onCancel={() => setUnsettleError(null)}
          />
        )}
      </>
    )
  }

  // List mode - check for errors and loading state
  if (trades.error) {
    return errorOut("Error retrieving trades", trades.error)
  }
  if (asset.error) {
    return errorOut("Error retrieving asset information", asset.error)
  }
  if (asset.isLoading || trades.isLoading) {
    return rootLoader("Loading...")
  }

  if (!trnResults || trnResults.length === 0) {
    return (
      <div id="root" className="text-center py-8">
        <p className="text-gray-500 mb-4">{"No transactions found"}</p>
        <button
          onClick={() => router.back()}
          className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300 transition-colors"
        >
          <i className="fa fa-arrow-left mr-2"></i>
          {"Back"}
        </button>
      </div>
    )
  }
  return (
    <div className="min-h-screen bg-gray-50 text-sm">
      {/* Header with back button */}
      <nav className="bg-white shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center">
            <button
              onClick={() => router.back()}
              className="flex items-center text-gray-600 hover:text-gray-900"
            >
              <i className="fa fa-arrow-left mr-2"></i>
              <span className="hidden sm:inline">{"Back"}</span>
            </button>
            <div className="flex-1 text-lg font-semibold text-center truncate">
              {asset.data.data.name}
              <span className="text-gray-500 text-sm ml-2">
                {asset.data.data.market.code}
              </span>
            </div>
            <div className="w-16"></div>
          </div>
        </div>
      </nav>

      {/* Tabs for switching between Trades and Events.
          Events are per-portfolio, so they are hidden in the aggregated
          (multi-portfolio) drill-down. */}
      {!isMulti && (
        <div className="bg-white border-b">
          <div className="container mx-auto px-4">
            <div className="flex">
              <button
                className="px-4 py-2 font-medium border-b-2 border-blue-500 text-blue-600"
                onClick={() =>
                  router.replace(`/trns/trades/${portfolioId}/${assetId}`)
                }
              >
                {"Trades"}
              </button>
              <button
                className="px-4 py-2 font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700"
                onClick={() =>
                  router.replace(`/trns/events/${portfolioId}/${assetId}`)
                }
              >
                {"Events"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-4">
        {/* Mobile: Card layout grouped by broker */}
        <div className="md:hidden space-y-4">
          {groups.map((group) => (
            <div key={group.id}>
              {/* Group Header (broker, or portfolio in the aggregated view) */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-t-lg px-4 py-2 flex justify-between items-center">
                {renderGroupLabel(group)}
                <span className="text-sm text-indigo-600">
                  {group.transactions.length}{" "}
                  {group.transactions.length === 1 ? "Trade" : "Trades"}
                </span>
              </div>
              {/* Transactions */}
              <div className="space-y-2 border-l border-r border-indigo-200 bg-white">
                {group.transactions.map((trn: Transaction) => (
                  <div
                    key={trn.id}
                    className="p-4 space-y-2 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-100"
                    onDoubleClick={() =>
                      router.push(
                        `/trns/trades/edit/${trn.portfolio.id}/${trn.id}`,
                      )
                    }
                    title={"Double-click to edit"}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span
                          className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                            trn.trnType === "BUY"
                              ? "bg-green-100 text-green-800"
                              : trn.trnType === "SELL" ||
                                  trn.trnType === "EXPENSE" ||
                                  trn.trnType === "DEDUCTION"
                                ? "bg-red-100 text-red-800"
                                : trn.trnType === "COST_ADJUST"
                                  ? "bg-orange-100 text-orange-800"
                                  : trn.trnType === "INCOME"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {trn.trnType}
                        </span>
                        <span
                          className="ml-2 text-sm font-medium text-gray-900"
                          title={getDisplayCode(trn.asset)}
                        >
                          {getDisplayCode(trn.asset)}
                        </span>
                        <span className="ml-2 text-sm text-gray-500">
                          {trn.tradeCurrency.code}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                            trn.status === "SETTLED"
                              ? "bg-green-100 text-green-800"
                              : trn.status === "PROPOSED"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {trn.status}
                        </span>
                        <span className="text-sm text-gray-500">
                          {trn.tradeDate}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {trn.trnType !== "INCOME" &&
                        trn.trnType !== "EXPENSE" && (
                          <>
                            <div>
                              <span className="text-gray-500">{"Qty"}:</span>
                              <span className="ml-1 font-medium">
                                <NumericFormat
                                  value={trn.quantity}
                                  displayType={"text"}
                                  decimalScale={2}
                                  thousandSeparator={true}
                                />
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">{"Price"}:</span>
                              <span className="ml-1 font-medium">
                                <NumericFormat
                                  value={trn.price}
                                  displayType={"text"}
                                  decimalScale={2}
                                  thousandSeparator={true}
                                />
                              </span>
                            </div>
                          </>
                        )}
                      <div>
                        <span className="text-gray-500">{"Amount"}:</span>
                        <span className="ml-1 font-medium">
                          <NumericFormat
                            value={trn.tradeAmount}
                            displayType={"text"}
                            decimalScale={2}
                            fixedDecimalScale={true}
                            thousandSeparator={true}
                          />
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">{"Cash"}:</span>
                        <span className="ml-1 font-medium">
                          <NumericFormat
                            value={trn.cashAmount}
                            displayType={"text"}
                            decimalScale={2}
                            thousandSeparator={true}
                          />
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Group Totals */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-b-lg px-4 py-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-indigo-600">{"Qty"}:</span>
                    <span className="ml-1 font-semibold text-indigo-900">
                      <NumericFormat
                        value={group.totals.quantity}
                        displayType={"text"}
                        decimalScale={2}
                        fixedDecimalScale={true}
                        thousandSeparator={true}
                      />
                    </span>
                  </div>
                  <div>
                    <span className="text-indigo-600">{"Amount"}:</span>
                    <span className="ml-1 font-semibold text-indigo-900">
                      <NumericFormat
                        value={group.totals.tradeAmount}
                        displayType={"text"}
                        decimalScale={2}
                        fixedDecimalScale={true}
                        thousandSeparator={true}
                      />
                    </span>
                  </div>
                  <div>
                    <span className="text-indigo-600">{"Cash"}:</span>
                    <span className="ml-1 font-semibold text-indigo-900">
                      <NumericFormat
                        value={group.totals.cashAmount}
                        displayType={"text"}
                        decimalScale={2}
                        fixedDecimalScale={true}
                        thousandSeparator={true}
                      />
                    </span>
                  </div>
                  {(group.totals.fees > 0 || group.totals.tax > 0) && (
                    <>
                      <div>
                        <span className="text-indigo-600">{"Fees"}:</span>
                        <span className="ml-1 font-semibold text-indigo-900">
                          <NumericFormat
                            value={group.totals.fees}
                            displayType={"text"}
                            decimalScale={2}
                            thousandSeparator={true}
                          />
                        </span>
                      </div>
                      <div>
                        <span className="text-indigo-600">{"Tax"}:</span>
                        <span className="ml-1 font-semibold text-indigo-900">
                          <NumericFormat
                            value={group.totals.tax}
                            displayType={"text"}
                            decimalScale={2}
                            thousandSeparator={true}
                          />
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop: Table layout grouped by broker */}
        <div className="hidden md:block space-y-4">
          {groups.map((group) => (
            <div
              key={group.id}
              className="bg-white rounded-lg shadow overflow-hidden"
            >
              {/* Group Header (broker, or portfolio in the aggregated view) */}
              <div className="bg-indigo-50 border-b border-indigo-200 px-4 py-3 flex justify-between items-center">
                {renderGroupLabel(group)}
                <span className="text-sm text-indigo-600">
                  {group.transactions.length}{" "}
                  {group.transactions.length === 1 ? "Trade" : "Trades"}
                </span>
              </div>
              {/* Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        {"Type"}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        {"Asset"}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        {"Currency"}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        {"Trade Date"}
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        {"Qty"}
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        {"Price"}
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        {"Amount"}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        {"Settlement Account"}
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        {"Cash"}
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        {"Tax"}
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        {"Fees"}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        {"Status"}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        {"Comments"}
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        {"Actions"}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {group.transactions.map((trn: Transaction) => (
                      <tr
                        key={trn.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onDoubleClick={() =>
                          router.push(
                            `/trns/trades/edit/${trn.portfolio.id}/${trn.id}`,
                          )
                        }
                        title={"Double-click to edit"}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          {trn.trnType}
                        </td>
                        <td
                          className="px-4 py-3 whitespace-nowrap"
                          title={getDisplayCode(trn.asset)}
                        >
                          <div className="font-medium text-gray-900">
                            {getDisplayCode(trn.asset)}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {trn.tradeCurrency.code}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {trn.tradeDate}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {trn.trnType === "INCOME" ||
                          trn.trnType === "EXPENSE" ? (
                            <span className="text-gray-400">-</span>
                          ) : (
                            <NumericFormat
                              value={trn.quantity}
                              displayType={"text"}
                              decimalScale={2}
                              fixedDecimalScale={true}
                              thousandSeparator={true}
                            />
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {trn.trnType === "INCOME" ||
                          trn.trnType === "EXPENSE" ? (
                            <span className="text-gray-400">-</span>
                          ) : (
                            <NumericFormat
                              value={trn.price}
                              displayType={"text"}
                              decimalScale={2}
                              fixedDecimalScale={true}
                              thousandSeparator={true}
                            />
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <NumericFormat
                            value={trn.tradeAmount}
                            displayType={"text"}
                            decimalScale={2}
                            fixedDecimalScale={true}
                            thousandSeparator={true}
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                          {["ADD", "REDUCE", "SPLIT", "COST_ADJUST"].includes(
                            trn.trnType,
                          )
                            ? "-"
                            : trn.cashAsset?.market?.code === "CASH"
                              ? trn.cashAsset.name ||
                                `${trn.cashAsset.code} Balance`
                              : trn.cashAsset?.name ||
                                getDisplayCode(trn.cashAsset) ||
                                `${(trn.cashCurrency as any)?.code || trn.tradeCurrency?.code} Balance`}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <NumericFormat
                            value={trn.cashAmount}
                            displayType={"text"}
                            decimalScale={2}
                            fixedDecimalScale={true}
                            thousandSeparator={true}
                          />
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <NumericFormat
                            value={trn.tax}
                            displayType={"text"}
                            decimalScale={2}
                            fixedDecimalScale={true}
                            thousandSeparator={true}
                          />
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <NumericFormat
                            value={trn.fees}
                            displayType={"text"}
                            decimalScale={2}
                            fixedDecimalScale={true}
                            thousandSeparator={true}
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                              trn.status === "SETTLED"
                                ? "bg-green-100 text-green-800"
                                : trn.status === "PROPOSED"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {trn.status}
                          </span>
                        </td>
                        <td
                          className="px-4 py-3 text-gray-600 max-w-xs truncate"
                          title={trn.comments || ""}
                        >
                          {trn.comments || "-"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                router.push(
                                  `/trns/trades/edit/${trn.portfolio.id}/${trn.id}`,
                                )
                              }}
                              className="text-gray-400 hover:text-blue-600 p-1"
                              title={"Edit"}
                            >
                              <i className="fas fa-edit"></i>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => copyRowToClipboard(trn, e)}
                              className="text-gray-400 hover:text-gray-600 p-1"
                              title={"Copy"}
                            >
                              <i className="fas fa-copy"></i>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setListDeleteTarget({
                                  id: trn.id,
                                  portfolioCode: trn.portfolio.code,
                                })
                              }}
                              className="text-gray-400 hover:text-red-600 p-1"
                              title={"Delete"}
                            >
                              <i className="fas fa-trash-alt"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Group Totals Row */}
                  <tfoot className="bg-indigo-50 border-t-2 border-indigo-200">
                    <tr className="font-semibold text-indigo-900">
                      <td className="px-4 py-3" colSpan={4}>
                        {"Total"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <NumericFormat
                          value={group.totals.quantity}
                          displayType={"text"}
                          decimalScale={2}
                          fixedDecimalScale={true}
                          thousandSeparator={true}
                        />
                      </td>
                      <td className="px-4 py-3"></td>
                      <td className="px-4 py-3 text-right">
                        <NumericFormat
                          value={group.totals.tradeAmount}
                          displayType={"text"}
                          decimalScale={2}
                          fixedDecimalScale={true}
                          thousandSeparator={true}
                        />
                      </td>
                      <td className="px-4 py-3"></td>
                      <td className="px-4 py-3 text-right">
                        <NumericFormat
                          value={group.totals.cashAmount}
                          displayType={"text"}
                          decimalScale={2}
                          fixedDecimalScale={true}
                          thousandSeparator={true}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <NumericFormat
                          value={group.totals.tax}
                          displayType={"text"}
                          decimalScale={2}
                          fixedDecimalScale={true}
                          thousandSeparator={true}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <NumericFormat
                          value={group.totals.fees}
                          displayType={"text"}
                          decimalScale={2}
                          fixedDecimalScale={true}
                          thousandSeparator={true}
                        />
                      </td>
                      <td className="px-4 py-3"></td>
                      <td className="px-4 py-3"></td>
                      <td className="px-4 py-3"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
      {listDeleteTarget && (
        <ConfirmDialog
          title={"Delete Transaction"}
          message={"Permanently delete this transaction?"}
          confirmLabel={"Delete"}
          cancelLabel={"Cancel"}
          variant="red"
          onConfirm={handleListDeleteConfirm}
          onCancel={() => setListDeleteTarget(null)}
        />
      )}
    </div>
  )
})
