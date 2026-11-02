import React, { useState, useEffect, useMemo, useCallback } from "react"
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
import { deleteTrn, unsettleTrn } from "@utils/api/client/trns"
import { buildTradeGroups } from "@utils/trns/tradeUtils"
import { holdingsHighlightHref } from "@utils/holdings/holdingsHref"
import { aggregatedHoldingsTodayKey } from "@utils/api/client/holdings"
import {
  TrnCardValue,
  TrnColumn,
  TrnDeleteConfirm,
  TrnDetailTabs,
  TrnEmptyState,
  TrnNumber,
  TrnNumberCell,
  TrnPageNav,
  TrnRowActions,
  TrnStatusBadge,
  TrnTableHead,
} from "@components/features/transactions/TrnListParts"
import { useTrnListDelete } from "@components/features/transactions/useTrnListDelete"

const COLUMNS: TrnColumn[] = [
  { label: "Type" },
  { label: "Asset" },
  { label: "Currency" },
  { label: "Trade Date" },
  { label: "Qty", align: "right" },
  { label: "Price", align: "right" },
  { label: "Amount", align: "right" },
  { label: "Settlement Account" },
  { label: "Cash", align: "right" },
  { label: "Tax", align: "right" },
  { label: "Fees", align: "right" },
  { label: "Status" },
  { label: "Comments" },
  { label: "Actions", align: "center" },
]

function TradeCount({ count }: { count: number }): React.ReactElement {
  return (
    <span className="text-sm text-indigo-600">
      {count} {count === 1 ? "Trade" : "Trades"}
    </span>
  )
}

function GroupTotalValue(
  props: React.ComponentProps<typeof TrnCardValue>,
): React.ReactElement {
  return (
    <TrnCardValue
      labelClassName="text-indigo-600"
      valueClassName="ml-1 font-semibold text-indigo-900"
      {...props}
    />
  )
}

function GroupTotalCell({
  value,
}: {
  value: number | undefined
}): React.ReactElement {
  return (
    <TrnNumberCell value={value} scale={2} className="px-4 py-3 text-right" />
  )
}

export default withPageAuthRequired(function Trades(): React.ReactElement {
  const router = useRouter()
  const [editModalOpen, setEditModalOpen] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [unsettleError, setUnsettleError] = useState<string | null>(null)

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
  const { deletePending, requestDelete, cancelDelete, confirmDelete } =
    useTrnListDelete(trades.mutate)

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

  const editTrn = (trn: Transaction): void => {
    router.push(`/trns/trades/edit/${trn.portfolio.id}/${trn.id}`)
  }

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
      return <TrnEmptyState id="root" />
    }

    const handleClose = (): void => {
      setEditModalOpen(false)
      router.back()
    }

    const handleDeleteConfirm = async (): Promise<void> => {
      setShowDeleteConfirm(false)
      try {
        const response = await deleteTrn(transaction.id)
        if (response.ok) {
          // Invalidate holdings cache after delete (with delay for message broker)
          setTimeout(() => {
            mutate(holdingKey(transaction.portfolio.code, "today"))
            mutate(aggregatedHoldingsTodayKey)
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
        // On unsettle the server reverts the auto-settled cash legs to PROPOSED
        // (not deleted). Invalidate holdings so the row reflects the new PROPOSED
        // status, then close.
        setTimeout(() => {
          mutate(holdingKey(transaction.portfolio.code, "today"))
          mutate(aggregatedHoldingsTodayKey)
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
          <TrnDeleteConfirm
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
    return <TrnEmptyState id="root" />
  }
  return (
    <div className="min-h-screen bg-gray-50 text-sm">
      {/* Header with back button */}
      <TrnPageNav
        title={asset.data.data.name}
        subtitle={asset.data.data.market.code}
      />

      {/* Tabs for switching between Trades and Events.
          Events are per-portfolio, so they are hidden in the aggregated
          (multi-portfolio) drill-down. */}
      {!isMulti && (
        <TrnDetailTabs
          active="trades"
          portfolioId={portfolioId}
          assetId={assetId}
        />
      )}

      <div className="container mx-auto px-4 py-4">
        {/* Mobile: Card layout grouped by broker */}
        <div className="md:hidden space-y-4">
          {groups.map((group) => (
            <div key={group.id}>
              {/* Group Header (broker, or portfolio in the aggregated view) */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-t-lg px-4 py-2 flex justify-between items-center">
                {renderGroupLabel(group)}
                <TradeCount count={group.transactions.length} />
              </div>
              {/* Transactions */}
              <div className="space-y-2 border-l border-r border-indigo-200 bg-white">
                {group.transactions.map((trn: Transaction) => (
                  <div
                    key={trn.id}
                    className="p-4 space-y-2 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-100"
                    onDoubleClick={() => editTrn(trn)}
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
                        <TrnStatusBadge status={trn.status} />
                        <span className="text-sm text-gray-500">
                          {trn.tradeDate}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {trn.trnType !== "INCOME" &&
                        trn.trnType !== "EXPENSE" && (
                          <>
                            <TrnCardValue
                              label={"Qty"}
                              value={trn.quantity}
                              scale={2}
                              fixed={false}
                            />
                            <TrnCardValue
                              label={"Price"}
                              value={trn.price}
                              scale={2}
                              fixed={false}
                            />
                          </>
                        )}
                      <TrnCardValue
                        label={"Amount"}
                        value={trn.tradeAmount}
                        scale={2}
                      />
                      <TrnCardValue
                        label={"Cash"}
                        value={trn.cashAmount}
                        scale={2}
                        fixed={false}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {/* Group Totals */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-b-lg px-4 py-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <GroupTotalValue
                    label={"Qty"}
                    value={group.totals.quantity}
                    scale={2}
                  />
                  <GroupTotalValue
                    label={"Amount"}
                    value={group.totals.tradeAmount}
                    scale={2}
                  />
                  <GroupTotalValue
                    label={"Cash"}
                    value={group.totals.cashAmount}
                    scale={2}
                  />
                  {(group.totals.fees > 0 || group.totals.tax > 0) && (
                    <>
                      <GroupTotalValue
                        label={"Fees"}
                        value={group.totals.fees}
                        scale={2}
                        fixed={false}
                      />
                      <GroupTotalValue
                        label={"Tax"}
                        value={group.totals.tax}
                        scale={2}
                        fixed={false}
                      />
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
                <TradeCount count={group.transactions.length} />
              </div>
              {/* Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <TrnTableHead columns={COLUMNS} />
                  <tbody className="divide-y divide-gray-200">
                    {group.transactions.map((trn: Transaction) => (
                      <tr
                        key={trn.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onDoubleClick={() => editTrn(trn)}
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
                            <TrnNumber value={trn.quantity} scale={2} />
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {trn.trnType === "INCOME" ||
                          trn.trnType === "EXPENSE" ? (
                            <span className="text-gray-400">-</span>
                          ) : (
                            <TrnNumber value={trn.price} scale={2} />
                          )}
                        </td>
                        <TrnNumberCell value={trn.tradeAmount} scale={2} />
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
                        <TrnNumberCell value={trn.cashAmount} scale={2} />
                        <TrnNumberCell value={trn.tax} scale={2} />
                        <TrnNumberCell value={trn.fees} scale={2} />
                        <td className="px-4 py-3 whitespace-nowrap">
                          <TrnStatusBadge status={trn.status} />
                        </td>
                        <td
                          className="px-4 py-3 text-gray-600 max-w-xs truncate"
                          title={trn.comments || ""}
                        >
                          {trn.comments || "-"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <TrnRowActions
                            onEdit={() => editTrn(trn)}
                            onCopy={(e) => copyRowToClipboard(trn, e)}
                            onDelete={() => requestDelete(trn)}
                          />
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
                      <GroupTotalCell value={group.totals.quantity} />
                      <td className="px-4 py-3"></td>
                      <GroupTotalCell value={group.totals.tradeAmount} />
                      <td className="px-4 py-3"></td>
                      <GroupTotalCell value={group.totals.cashAmount} />
                      <GroupTotalCell value={group.totals.tax} />
                      <GroupTotalCell value={group.totals.fees} />
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
      {deletePending && (
        <TrnDeleteConfirm onConfirm={confirmDelete} onCancel={cancelDelete} />
      )}
    </div>
  )
})
