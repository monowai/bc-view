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
  TrnNumberCell,
  TrnPageNav,
  TrnRowActions,
  TrnStatusBadge,
  TrnTableHead,
  TrnTypeBadge,
  useTrnTabSignals,
} from "@components/features/transactions/TrnListParts"
import { useTrnListDelete } from "@components/features/transactions/useTrnListDelete"
import SpendLogDialog from "@components/features/wealth/SpendLogDialog"
import { spendWithdrawalMonth } from "@lib/independence/spendWithdrawal"
import {
  anyNonZero,
  settlementLabel,
  uniformCurrency,
} from "@utils/trns/trnListView"

const CELL = "px-3 py-2"
const NUM_CELL = `${CELL} text-right whitespace-nowrap`

interface TradeColumnFlags {
  /** The trade currency every row shares; when absent, each row shows its own. */
  currency: string | undefined
  showFees: boolean
  showTax: boolean
}

/**
 * Columns fit the page without sideways scrolling. Every row is the same
 * asset, so there is no Asset column; the shared currency moves into the
 * Amount header; Fees and Tax show only when some trade carries them; and a
 * comment sits under the settlement account instead of in its own column.
 */
function tradeColumns({
  currency,
  showFees,
  showTax,
}: TradeColumnFlags): TrnColumn[] {
  return [
    { label: "Date" },
    { label: "Type" },
    ...(currency ? [] : [{ label: "Currency" }]),
    { label: "Qty", align: "right" as const },
    { label: "Price", align: "right" as const },
    { label: "Amount", align: "right" as const, hint: currency },
    { label: "Cash", align: "right" as const },
    ...(showFees ? [{ label: "Fees", align: "right" as const }] : []),
    ...(showTax ? [{ label: "Tax", align: "right" as const }] : []),
    { label: "Settled to" },
    { label: "Status" },
    { label: "Actions", align: "right" as const, srOnly: true },
  ]
}

/** Income and expense rows carry no units or price. */
const isCashOnly = (trn: Transaction): boolean =>
  trn.trnType === "INCOME" || trn.trnType === "EXPENSE"

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
    <TrnNumberCell
      value={value}
      scale={2}
      className="px-3 py-2 text-right whitespace-nowrap"
    />
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
  // Events are per-portfolio, so the aggregated drill-down has no tabs.
  const signals = useTrnTabSignals(
    isMulti || isEditMode ? undefined : portfolioId,
    isMulti || isEditMode ? undefined : assetId,
  )

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
  // Decided over every trade on the page, so each broker's table has the
  // same columns.
  const flags: TradeColumnFlags = {
    currency: uniformCurrency(trnResults),
    showFees: anyNonZero(trnResults, "fees"),
    showTax: anyNonZero(trnResults, "tax"),
  }
  const columns = tradeColumns(flags)

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
          title="Brokerage account"
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

    // svc-retire owns a month's spend withdrawal and rewrites it on every save,
    // so it is edited through the spend log for that month.
    const spendMonth = spendWithdrawalMonth(transaction)
    if (spendMonth) {
      return <SpendLogDialog initialMonth={spendMonth} onClose={handleClose} />
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
          signals={signals}
        />
      )}

      <div className="container mx-auto px-4 py-4">
        {/* Narrow screens: cards grouped by broker */}
        <div className="lg:hidden space-y-4">
          {groups.map((group) => (
            <div key={group.id}>
              {/* Group Header (broker, or portfolio in the aggregated view) */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-t-lg px-4 py-2 flex justify-between items-center">
                {renderGroupLabel(group)}
                <TradeCount count={group.transactions.length} />
              </div>
              <div className="divide-y divide-gray-100 border-x border-indigo-200 bg-white">
                {group.transactions.map((trn: Transaction) => (
                  <div
                    key={trn.id}
                    className="p-3 space-y-2 cursor-pointer hover:bg-blue-50/50 transition-colors"
                    onDoubleClick={() => editTrn(trn)}
                    title={"Double-click to edit"}
                  >
                    <div className="flex justify-between items-center gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono tabular-nums text-gray-900">
                          {trn.tradeDate}
                        </span>
                        <TrnTypeBadge trnType={trn.trnType} />
                        {!flags.currency && (
                          <span className="text-xs text-gray-500">
                            {trn.tradeCurrency.code}
                          </span>
                        )}
                      </div>
                      <TrnStatusBadge status={trn.status} />
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                      {!isCashOnly(trn) && (
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
                            blankZero
                          />
                        </>
                      )}
                      <TrnCardValue
                        label={"Amount"}
                        value={trn.tradeAmount}
                        scale={2}
                        blankZero
                        valueClassName="ml-1 font-semibold text-gray-900"
                      />
                      <TrnCardValue
                        label={"Cash"}
                        value={trn.cashAmount}
                        scale={2}
                        blankZero
                      />
                      {!!trn.fees && (
                        <TrnCardValue
                          label={"Fees"}
                          value={trn.fees}
                          scale={2}
                        />
                      )}
                      {!!trn.tax && (
                        <TrnCardValue label={"Tax"} value={trn.tax} scale={2} />
                      )}
                    </div>
                    {trn.comments && (
                      <p className="text-xs text-gray-500 truncate">
                        {trn.comments}
                      </p>
                    )}
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

        {/* Wide screens: a table per broker, sized to fit without scrolling */}
        <div className="hidden lg:block space-y-4">
          {groups.map((group) => (
            <div
              key={group.id}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden"
            >
              {/* Group Header (broker, or portfolio in the aggregated view) */}
              <div className="bg-indigo-50 border-b border-indigo-200 px-4 py-2.5 flex justify-between items-center">
                {renderGroupLabel(group)}
                <TradeCount count={group.transactions.length} />
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <TrnTableHead columns={columns} cellClassName={CELL} />
                  <tbody className="divide-y divide-gray-100">
                    {group.transactions.map((trn: Transaction) => {
                      const settledTo = settlementLabel(trn)
                      return (
                        <tr
                          key={trn.id}
                          className="hover:bg-blue-50/60 transition-colors cursor-pointer"
                          onDoubleClick={() => editTrn(trn)}
                          title={"Double-click to edit"}
                        >
                          <td
                            className={`${CELL} whitespace-nowrap font-mono tabular-nums text-gray-900`}
                          >
                            {trn.tradeDate}
                          </td>
                          <td className={`${CELL} whitespace-nowrap`}>
                            <TrnTypeBadge trnType={trn.trnType} />
                          </td>
                          {!flags.currency && (
                            <td className={`${CELL} whitespace-nowrap`}>
                              {trn.tradeCurrency.code}
                            </td>
                          )}
                          <TrnNumberCell
                            value={isCashOnly(trn) ? undefined : trn.quantity}
                            scale={2}
                            blankZero
                            className={`${NUM_CELL} text-gray-900`}
                          />
                          <TrnNumberCell
                            value={isCashOnly(trn) ? undefined : trn.price}
                            scale={2}
                            blankZero
                            className={`${NUM_CELL} text-gray-600`}
                          />
                          <TrnNumberCell
                            value={trn.tradeAmount}
                            scale={2}
                            blankZero
                            className={`${NUM_CELL} font-medium text-gray-900`}
                          />
                          <TrnNumberCell
                            value={trn.cashAmount}
                            scale={2}
                            blankZero
                            className={`${NUM_CELL} text-gray-600`}
                          />
                          {flags.showFees && (
                            <TrnNumberCell
                              value={trn.fees}
                              scale={2}
                              blankZero
                              className={`${NUM_CELL} text-gray-600`}
                            />
                          )}
                          {flags.showTax && (
                            <TrnNumberCell
                              value={trn.tax}
                              scale={2}
                              blankZero
                              className={`${NUM_CELL} text-gray-600`}
                            />
                          )}
                          <td className={`${CELL} max-w-[14rem]`}>
                            <div className="truncate text-gray-600">
                              {settledTo ?? (
                                <span className="text-gray-300">{"–"}</span>
                              )}
                            </div>
                            {trn.comments && (
                              <div
                                className="truncate text-xs text-gray-500"
                                title={trn.comments}
                              >
                                {trn.comments}
                              </div>
                            )}
                          </td>
                          <td className={`${CELL} whitespace-nowrap`}>
                            <TrnStatusBadge status={trn.status} />
                          </td>
                          <td className={`${CELL} whitespace-nowrap`}>
                            <TrnRowActions
                              onEdit={() => editTrn(trn)}
                              onCopy={(e) => copyRowToClipboard(trn, e)}
                              onDelete={() => requestDelete(trn)}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  {/* Group Totals Row */}
                  <tfoot className="bg-indigo-50 border-t-2 border-indigo-200">
                    <tr className="font-semibold text-indigo-900">
                      <td className={CELL} colSpan={flags.currency ? 2 : 3}>
                        {"Total"}
                      </td>
                      <GroupTotalCell value={group.totals.quantity} />
                      <td className={CELL}></td>
                      <GroupTotalCell value={group.totals.tradeAmount} />
                      <GroupTotalCell value={group.totals.cashAmount} />
                      {flags.showFees && (
                        <GroupTotalCell value={group.totals.fees} />
                      )}
                      {flags.showTax && (
                        <GroupTotalCell value={group.totals.tax} />
                      )}
                      <td className={CELL} colSpan={3}></td>
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
