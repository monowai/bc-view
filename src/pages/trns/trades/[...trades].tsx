import React, { useState, useEffect, useMemo } from "react"
import { NumericFormat } from "react-number-format"
import { GetServerSideProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { useRouter } from "next/router"
import {
  assetKey,
  simpleFetcher,
  tradeKey,
  trnKey,
  holdingKey,
} from "@utils/api/fetchHelper"
import { useTranslation } from "next-i18next"
import { Transaction } from "types/beancounter"
import { rootLoader } from "@components/ui/PageLoader"
import { errorOut } from "@components/errors/ErrorOut"
import useSwr, { mutate } from "swr"
import { getDisplayCode } from "@lib/assets/assetUtils"
import FxEditModal from "@components/features/transactions/FxEditModal"
import TradeInputForm from "@pages/trns/trade"

export default withPageAuthRequired(function Trades(): React.ReactElement {
  const { t } = useTranslation("common")
  const router = useRouter()
  const [editModalOpen, setEditModalOpen] = useState(true)

  // Extract query params - safe to access even before router is ready (will be undefined)
  const tradesParam = router.query.trades as string[] | undefined

  // Detect if this is an edit request: /trns/trades/edit/[portfolioId]/[trnId]
  const isEditMode = tradesParam && tradesParam[0] === "edit"

  // For edit mode: trades[1] = portfolioId, trades[2] = trnId
  // For list mode: trades[0] = portfolioId, trades[1] = assetId
  const portfolioId = isEditMode
    ? tradesParam![1]
    : tradesParam
      ? tradesParam[0]
      : undefined
  const assetId = tradesParam ? tradesParam[1] : undefined
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
  const trades = useSwr(
    router.isReady && !isEditMode && portfolioId && assetId
      ? tradeKey(portfolioId as string, assetId as string)
      : null,
    router.isReady && !isEditMode && portfolioId && assetId
      ? simpleFetcher(tradeKey(portfolioId as string, assetId as string))
      : null,
  )

  // Group transactions by broker (must be called before any early returns for hooks rules)
  const trnResults = useMemo(
    (): Transaction[] => trades.data?.data || [],
    [trades.data?.data],
  )
  const groupedByBroker = useMemo(() => {
    if (!trnResults || trnResults.length === 0) return []

    const groups: Record<
      string,
      {
        broker: { id: string; name: string } | null
        transactions: Transaction[]
        totals: {
          quantity: number
          tradeAmount: number
          cashAmount: number
          fees: number
          tax: number
        }
      }
    > = {}

    trnResults.forEach((trn: Transaction) => {
      const brokerKey = trn.broker?.id || "__no_broker__"
      if (!groups[brokerKey]) {
        groups[brokerKey] = {
          broker: trn.broker || null,
          transactions: [],
          totals: {
            quantity: 0,
            tradeAmount: 0,
            cashAmount: 0,
            fees: 0,
            tax: 0,
          },
        }
      }
      groups[brokerKey].transactions.push(trn)
      groups[brokerKey].totals.quantity += trn.quantity || 0
      groups[brokerKey].totals.tradeAmount += trn.tradeAmount || 0
      groups[brokerKey].totals.cashAmount += trn.cashAmount || 0
      groups[brokerKey].totals.fees += trn.fees || 0
      groups[brokerKey].totals.tax += trn.tax || 0
    })

    // Sort: brokers with names first (alphabetically), then "No Broker" last
    return Object.values(groups).sort((a, b) => {
      if (!a.broker && b.broker) return 1
      if (a.broker && !b.broker) return -1
      if (!a.broker && !b.broker) return 0
      return (a.broker?.name || "").localeCompare(b.broker?.name || "")
    })
  }, [trnResults])

  // Wait for router to be ready (query params available) during client-side navigation
  if (!router.isReady) {
    return rootLoader(t("loading"))
  }

  // Handle edit mode
  if (isEditMode) {
    if (singleTrn.error) {
      return errorOut(t("trades.error.retrieve"), singleTrn.error)
    }
    if (singleTrn.isLoading) {
      return rootLoader(t("loading"))
    }
    // API returns an array, get the first transaction
    const transaction = Array.isArray(singleTrn.data?.data)
      ? singleTrn.data.data[0]
      : singleTrn.data?.data

    if (!transaction) {
      return (
        <div id="root" className="text-center py-8">
          <p className="text-gray-500 mb-4">{t("trn.noTransactions")}</p>
          <button
            onClick={() => router.back()}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300 transition-colors"
          >
            <i className="fa fa-arrow-left mr-2"></i>
            {t("back")}
          </button>
        </div>
      )
    }

    const handleClose = (): void => {
      setEditModalOpen(false)
      router.back()
    }

    const handleDelete = async (): Promise<void> => {
      if (!confirm(t("trn.delete"))) return
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

    // Use FxEditModal for FX transactions (FX, FX_BUY, FX_SELL)
    const isFxType =
      transaction.trnType === "FX" || transaction.trnType.startsWith("FX_")

    return editModalOpen ? (
      isFxType ? (
        <FxEditModal
          trn={transaction}
          onClose={handleClose}
          onDelete={handleDelete}
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
            onDelete: handleDelete,
          }}
        />
      )
    ) : (
      <></>
    )
  }

  // List mode - check for errors and loading state
  if (trades.error) {
    return errorOut(t("trades.error.retrieve"), trades.error)
  }
  if (asset.error) {
    return errorOut(t("assets.error.retrieve"), asset.error)
  }
  if (asset.isLoading || trades.isLoading) {
    return rootLoader(t("loading"))
  }

  if (!trnResults || trnResults.length === 0) {
    return (
      <div id="root" className="text-center py-8">
        <p className="text-gray-500 mb-4">{t("trn.noTransactions")}</p>
        <button
          onClick={() => router.back()}
          className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300 transition-colors"
        >
          <i className="fa fa-arrow-left mr-2"></i>
          {t("back")}
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
              <span className="hidden sm:inline">{t("back")}</span>
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

      {/* Tabs for switching between Trades and Events */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4">
          <div className="flex">
            <button
              className="px-4 py-2 font-medium border-b-2 border-blue-500 text-blue-600"
              onClick={() =>
                router.replace(`/trns/trades/${portfolioId}/${assetId}`)
              }
            >
              {t("trades")}
            </button>
            <button
              className="px-4 py-2 font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700"
              onClick={() =>
                router.replace(`/trns/events/${portfolioId}/${assetId}`)
              }
            >
              {t("events")}
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-4">
        {/* Mobile: Card layout grouped by broker */}
        <div className="md:hidden space-y-4">
          {groupedByBroker.map((group) => (
            <div key={group.broker?.id || "no-broker"}>
              {/* Broker Header */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-t-lg px-4 py-2 flex justify-between items-center">
                <span className="font-medium text-indigo-900">
                  <i className="fas fa-building mr-2 text-indigo-400"></i>
                  {group.broker?.name || t("trn.broker.none", "No Broker")}
                </span>
                <span className="text-sm text-indigo-600">
                  {group.transactions.length} {t("trades", "trades")}
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
                    title={t("actions.doubleClickToEdit")}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span
                          className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                            trn.trnType === "BUY"
                              ? "bg-green-100 text-green-800"
                              : trn.trnType === "SELL"
                                ? "bg-red-100 text-red-800"
                                : trn.trnType === "COST_ADJUST"
                                  ? "bg-orange-100 text-orange-800"
                                  : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {trn.trnType}
                        </span>
                        <span
                          className="ml-2 text-sm font-medium text-gray-900"
                          title={trn.asset.name || getDisplayCode(trn.asset)}
                        >
                          {getDisplayCode(trn.asset)}
                          {trn.asset.name && (
                            <span className="text-xs text-gray-500 ml-1">
                              (
                              {trn.asset.name.length > 20
                                ? `${trn.asset.name.substring(0, 20)}...`
                                : trn.asset.name}
                              )
                            </span>
                          )}
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
                      <div>
                        <span className="text-gray-500">{t("quantity")}:</span>
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
                        <span className="text-gray-500">{t("trn.price")}:</span>
                        <span className="ml-1 font-medium">
                          <NumericFormat
                            value={trn.price}
                            displayType={"text"}
                            decimalScale={2}
                            thousandSeparator={true}
                          />
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">
                          {t("trn.amount.trade")}:
                        </span>
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
                        <span className="text-gray-500">
                          {t("trn.amount.cash")}:
                        </span>
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
                    <span className="text-indigo-600">
                      {t("trn.amount.trade")}:
                    </span>
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
                    <span className="text-indigo-600">
                      {t("trn.amount.cash")}:
                    </span>
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
                        <span className="text-indigo-600">
                          {t("trn.amount.charges")}:
                        </span>
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
                        <span className="text-indigo-600">
                          {t("trn.amount.tax")}:
                        </span>
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
          {groupedByBroker.map((group) => (
            <div
              key={group.broker?.id || "no-broker"}
              className="bg-white rounded-lg shadow overflow-hidden"
            >
              {/* Broker Header */}
              <div className="bg-indigo-50 border-b border-indigo-200 px-4 py-3 flex justify-between items-center">
                <span className="font-medium text-indigo-900">
                  <i className="fas fa-building mr-2 text-indigo-400"></i>
                  {group.broker?.name || t("trn.broker.none", "No Broker")}
                </span>
                <span className="text-sm text-indigo-600">
                  {group.transactions.length} {t("trades", "trades")}
                </span>
              </div>
              {/* Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        {t("trn.type")}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        {t("asset", "Asset")}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        {t("trn.currency")}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        {t("trn.tradeDate")}
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        {t("quantity")}
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        {t("trn.price")}
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        {t("trn.amount.trade")}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        {t("trn.settlement.account")}
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        {t("trn.amount.cash")}
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        {t("trn.amount.tax")}
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        {t("trn.amount.charges")}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        {t("trn.status")}
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
                        title={t("actions.doubleClickToEdit")}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          {trn.trnType}
                        </td>
                        <td
                          className="px-4 py-3 whitespace-nowrap"
                          title={trn.asset.name || getDisplayCode(trn.asset)}
                        >
                          <div className="font-medium text-gray-900">
                            {getDisplayCode(trn.asset)}
                          </div>
                          {trn.asset.name && (
                            <div className="text-xs text-gray-500 truncate max-w-32">
                              {trn.asset.name.length > 20
                                ? `${trn.asset.name.substring(0, 20)}...`
                                : trn.asset.name}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {trn.tradeCurrency.code}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {trn.tradeDate}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <NumericFormat
                            value={trn.quantity}
                            displayType={"text"}
                            decimalScale={2}
                            fixedDecimalScale={true}
                            thousandSeparator={true}
                          />
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <NumericFormat
                            value={trn.price}
                            displayType={"text"}
                            decimalScale={2}
                            fixedDecimalScale={true}
                            thousandSeparator={true}
                          />
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
                      </tr>
                    ))}
                  </tbody>
                  {/* Group Totals Row */}
                  <tfoot className="bg-indigo-50 border-t-2 border-indigo-200">
                    <tr className="font-semibold text-indigo-900">
                      <td className="px-4 py-3" colSpan={4}>
                        {t("total", "Total")}
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
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
})

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
})
