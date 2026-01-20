import React, { useState, useMemo } from "react"
import useSwr from "swr"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { useTranslation } from "next-i18next"
import {
  Broker,
  BrokerHoldingsResponse,
  BrokerHoldingPosition,
  HoldingContract,
  Position,
} from "types/beancounter"
import { GetServerSideProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { simpleFetcher } from "@utils/api/fetchHelper"
import { errorOut } from "@components/errors/ErrorOut"
import { useRouter } from "next/router"
import { rootLoader } from "@components/ui/PageLoader"
import Link from "next/link"

const brokersKey = "/api/brokers"

export default withPageAuthRequired(
  function BrokerHoldings(): React.ReactElement {
    const { t, ready } = useTranslation("common")
    const router = useRouter()
    const { brokerId } = router.query
    const [expandedAsset, setExpandedAsset] = useState<string | null>(null)
    const [showZeroQuantities, setShowZeroQuantities] = useState<boolean>(false)
    const [reconciledAssets, setReconciledAssets] = useState<Set<string>>(
      new Set(),
    )

    const { data: brokersData, error: brokersError } = useSwr(
      brokersKey,
      simpleFetcher(brokersKey),
    )

    // Fetch split-adjusted positions from svc-position
    const positionsKey =
      brokerId && typeof brokerId === "string"
        ? `/api/holdings/broker/${brokerId}?value=false`
        : null
    const { data: positionsData, error: positionsError } = useSwr<{
      data: HoldingContract
    }>(positionsKey, positionsKey ? simpleFetcher(positionsKey) : null)

    // Fetch transaction details from bc-data for drill-down
    const transactionsKey =
      brokerId && typeof brokerId === "string"
        ? `/api/trns/broker/${brokerId}/holdings`
        : null
    const { data: transactionsData, error: transactionsError } =
      useSwr<BrokerHoldingsResponse>(
        transactionsKey,
        transactionsKey ? simpleFetcher(transactionsKey) : null,
      )

    // Merge data: use svc-position quantities with bc-data transaction details
    const mergedHoldings = useMemo(() => {
      if (!positionsData?.data?.positions) return null

      const positions = positionsData.data.positions
      const transactionDetails = transactionsData?.holdings || []

      // Build a lookup map for transaction details by asset ID
      const transactionsByAssetId: Record<string, BrokerHoldingPosition> = {}
      transactionDetails.forEach((h) => {
        transactionsByAssetId[h.assetId] = h
      })

      // Convert positions map to holdings array with merged data
      const holdings: BrokerHoldingPosition[] = (
        Object.values(positions) as Position[]
      ).map((pos) => {
        const txDetail = transactionsByAssetId[pos.asset.id]
        return {
          assetId: pos.asset.id,
          assetCode: pos.asset.code,
          assetName: pos.asset.name,
          market: pos.asset.market?.code || "",
          quantity: pos.quantityValues?.total || 0,
          portfolioGroups: txDetail?.portfolioGroups || [],
        }
      })

      // Sort by asset code
      holdings.sort((a, b) => {
        const aKey = `${a.market}:${a.assetCode}`
        const bKey = `${b.market}:${b.assetCode}`
        return aKey.localeCompare(bKey)
      })

      // Filter out zero quantities unless showZeroQuantities is enabled
      const filteredHoldings = showZeroQuantities
        ? holdings
        : holdings.filter((h) => h.quantity !== 0)

      // Get broker name from the transactions response or brokers list
      const brokerName =
        transactionsData?.brokerName ||
        brokersData?.data?.find((b: Broker) => b.id === brokerId)?.name ||
        (brokerId === "NO_BROKER" ? "Unassigned" : String(brokerId))

      return {
        brokerId: String(brokerId),
        brokerName,
        holdings: filteredHoldings,
        totalHoldings: holdings.length,
      } as BrokerHoldingsResponse & { totalHoldings: number }
    }, [
      positionsData,
      transactionsData,
      brokersData,
      brokerId,
      showZeroQuantities,
    ])

    if (brokersError || positionsError || transactionsError) {
      return errorOut(
        t("brokers.holdings.error", "Error loading broker holdings"),
        brokersError || positionsError || transactionsError,
      )
    }

    if (!ready || !brokersData || (brokerId && !positionsData)) {
      return rootLoader(t("loading"))
    }

    const brokers: Broker[] = brokersData.data || []
    const holdings:
      | (BrokerHoldingsResponse & { totalHoldings: number })
      | null = mergedHoldings

    const handleBrokerChange = (newBrokerId: string): void => {
      setExpandedAsset(null)
      router.push(`/brokers/${newBrokerId}/holdings`)
    }

    const toggleExpand = (assetId: string): void => {
      setExpandedAsset(expandedAsset === assetId ? null : assetId)
    }

    const toggleReconciled = (assetId: string): void => {
      setReconciledAssets((prev) => {
        const next = new Set(prev)
        if (next.has(assetId)) {
          next.delete(assetId)
        } else {
          next.add(assetId)
        }
        return next
      })
    }

    const formatQuantity = (qty: number): string => {
      return qty.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 4,
      })
    }

    const renderHoldingRow = (
      holding: BrokerHoldingPosition,
    ): React.ReactNode => {
      const isExpanded = expandedAsset === holding.assetId
      const isReconciled = reconciledAssets.has(holding.assetId)
      const assetDisplay = `${holding.market}:${holding.assetCode}`
      const portfolioGroups = holding.portfolioGroups || []

      return (
        <React.Fragment key={holding.assetId}>
          {/* Main row */}
          <tr
            className={
              isReconciled
                ? "bg-green-50 hover:bg-green-100"
                : "hover:bg-gray-50"
            }
          >
            <td className="px-4 py-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleReconciled(holding.assetId)}
                  className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    isReconciled
                      ? "bg-green-500 border-green-500 text-white"
                      : "border-gray-300 hover:border-green-400"
                  }`}
                  title={t(
                    isReconciled
                      ? "brokers.holdings.markUnreconciled"
                      : "brokers.holdings.markReconciled",
                    isReconciled
                      ? "Mark as unreconciled"
                      : "Mark as reconciled",
                  )}
                >
                  {isReconciled && <i className="fas fa-check text-xs"></i>}
                </button>
                <div>
                  <span
                    className={`font-semibold ${isReconciled ? "text-green-800" : "text-gray-900"}`}
                  >
                    {assetDisplay}
                  </span>
                  {holding.assetName && (
                    <p
                      className={`text-sm truncate max-w-xs ${isReconciled ? "text-green-600" : "text-gray-500"}`}
                      title={holding.assetName}
                    >
                      {holding.assetName.length > 30
                        ? `${holding.assetName.substring(0, 30)}...`
                        : holding.assetName}
                    </p>
                  )}
                </div>
              </div>
            </td>
            <td className="px-4 py-3 text-right">
              <button
                onClick={() => toggleExpand(holding.assetId)}
                className={`font-mono cursor-pointer hover:underline ${
                  isReconciled
                    ? "text-green-700"
                    : holding.quantity < 0
                      ? "text-red-600"
                      : "text-blue-600"
                }`}
                title={t(
                  "brokers.holdings.clickToExpand",
                  "Click to view transactions",
                )}
              >
                {formatQuantity(holding.quantity)}
                <i
                  className={`fas fa-chevron-${isExpanded ? "up" : "down"} ml-2 text-xs`}
                ></i>
              </button>
            </td>
          </tr>

          {/* Expanded detail */}
          {isExpanded && portfolioGroups.length > 0 && (
            <tr>
              <td colSpan={2} className="px-0 py-0 bg-gray-50">
                <div className="border-t border-b border-gray-200">
                  {portfolioGroups.map((pg) => (
                    <div
                      key={pg.portfolioId}
                      className="border-b border-gray-100 last:border-b-0"
                    >
                      {/* Portfolio header */}
                      <div className="px-4 py-2 bg-blue-50 flex justify-between items-center">
                        <span className="font-medium text-blue-800">
                          {pg.portfolioCode}
                        </span>
                        <span
                          className={`font-mono font-semibold ${
                            pg.quantity < 0 ? "text-red-600" : "text-gray-900"
                          }`}
                        >
                          {formatQuantity(pg.quantity)}
                        </span>
                      </div>

                      {/* Transactions */}
                      <table className="w-full">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-4 py-1 text-left text-xs font-medium text-gray-500">
                              {t("date", "Date")}
                            </th>
                            <th className="px-4 py-1 text-left text-xs font-medium text-gray-500">
                              {t("type", "Type")}
                            </th>
                            <th className="px-4 py-1 text-right text-xs font-medium text-gray-500">
                              {t("quantity", "Qty")}
                            </th>
                            <th className="px-4 py-1 text-right text-xs font-medium text-gray-500">
                              {t("price", "Price")}
                            </th>
                            <th className="px-4 py-1 text-right text-xs font-medium text-gray-500">
                              {t("amount", "Amount")}
                            </th>
                            <th className="px-4 py-1 w-10"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {pg.transactions.map((trn) => (
                            <tr key={trn.id} className="hover:bg-gray-50">
                              <td className="px-4 py-1 text-sm text-gray-600">
                                {trn.tradeDate}
                              </td>
                              <td className="px-4 py-1 text-sm">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                    trn.trnType === "BUY" ||
                                    trn.trnType === "ADD"
                                      ? "bg-green-100 text-green-800"
                                      : "bg-red-100 text-red-800"
                                  }`}
                                >
                                  {trn.trnType}
                                </span>
                              </td>
                              <td className="px-4 py-1 text-sm text-right font-mono">
                                {formatQuantity(trn.quantity)}
                              </td>
                              <td className="px-4 py-1 text-sm text-right font-mono text-gray-600">
                                {trn.price.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 4,
                                })}
                              </td>
                              <td className="px-4 py-1 text-sm text-right font-mono text-gray-600">
                                {trn.tradeAmount.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                              <td className="px-4 py-1 text-right">
                                <Link
                                  href={`/trns/trades/${pg.portfolioCode}?trnId=${trn.id}`}
                                  className="text-gray-400 hover:text-blue-600"
                                  title={t("edit", "Edit")}
                                >
                                  <i className="far fa-edit text-sm"></i>
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              </td>
            </tr>
          )}
        </React.Fragment>
      )
    }

    const renderMobileHolding = (
      holding: BrokerHoldingPosition,
    ): React.ReactNode => {
      const isExpanded = expandedAsset === holding.assetId
      const isReconciled = reconciledAssets.has(holding.assetId)
      const assetDisplay = `${holding.market}:${holding.assetCode}`
      const portfolioGroups = holding.portfolioGroups || []

      return (
        <div
          key={holding.assetId}
          className={`border-b ${isReconciled ? "border-green-200 bg-green-50" : "border-gray-200"}`}
        >
          {/* Main card */}
          <div className="p-4">
            <div className="flex justify-between items-start gap-3">
              <div className="flex items-start gap-3">
                <button
                  onClick={() => toggleReconciled(holding.assetId)}
                  className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors mt-0.5 ${
                    isReconciled
                      ? "bg-green-500 border-green-500 text-white"
                      : "border-gray-300 hover:border-green-400"
                  }`}
                  title={t(
                    isReconciled
                      ? "brokers.holdings.markUnreconciled"
                      : "brokers.holdings.markReconciled",
                    isReconciled
                      ? "Mark as unreconciled"
                      : "Mark as reconciled",
                  )}
                >
                  {isReconciled && <i className="fas fa-check text-xs"></i>}
                </button>
                <div>
                  <span
                    className={`font-semibold ${isReconciled ? "text-green-800" : "text-gray-900"}`}
                  >
                    {assetDisplay}
                  </span>
                  {holding.assetName && (
                    <p
                      className={`text-sm truncate max-w-[200px] ${isReconciled ? "text-green-600" : "text-gray-500"}`}
                    >
                      {holding.assetName}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => toggleExpand(holding.assetId)}
                className={`font-mono font-semibold ${
                  isReconciled
                    ? "text-green-700"
                    : holding.quantity < 0
                      ? "text-red-600"
                      : "text-blue-600"
                }`}
              >
                {formatQuantity(holding.quantity)}
                <i
                  className={`fas fa-chevron-${isExpanded ? "up" : "down"} ml-2 text-xs`}
                ></i>
              </button>
            </div>
          </div>

          {/* Expanded detail */}
          {isExpanded && portfolioGroups.length > 0 && (
            <div className="bg-gray-50 border-t border-gray-200 px-4 pb-4">
              {portfolioGroups.map((pg) => (
                <div key={pg.portfolioId} className="mt-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-blue-800">
                      {pg.portfolioCode}
                    </span>
                    <span
                      className={`font-mono font-semibold ${
                        pg.quantity < 0 ? "text-red-600" : "text-gray-900"
                      }`}
                    >
                      {formatQuantity(pg.quantity)}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {pg.transactions.map((trn) => (
                      <div
                        key={trn.id}
                        className="bg-white rounded p-2 flex justify-between items-center"
                      >
                        <div>
                          <span className="text-sm text-gray-600">
                            {trn.tradeDate}
                          </span>
                          <span
                            className={`ml-2 px-1.5 py-0.5 rounded text-xs font-medium ${
                              trn.trnType === "BUY" || trn.trnType === "ADD"
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {trn.trnType}
                          </span>
                          <span className="ml-2 font-mono text-sm">
                            {formatQuantity(trn.quantity)}
                          </span>
                        </div>
                        <Link
                          href={`/trns/trades/${pg.portfolioCode}?trnId=${trn.id}`}
                          className="text-gray-400 hover:text-blue-600 p-1"
                        >
                          <i className="far fa-edit"></i>
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="px-4 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => router.push("/brokers")}
                  className="text-gray-500 hover:text-gray-700 p-1 -ml-1"
                  title={t("back", "Back")}
                >
                  <i className="fas fa-arrow-left text-lg"></i>
                </button>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                  {t("brokers.holdings.title", "Broker Reconciliation")}
                </h1>
              </div>
            </div>
          </div>
        </div>

        {/* Broker Selector */}
        <div className="px-4 py-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("brokers.holdings.selectBroker", "Select Broker")}
                </label>
                <select
                  value={brokerId as string}
                  onChange={(e) => handleBrokerChange(e.target.value)}
                  className="w-full sm:w-64 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="NO_BROKER">
                    {t("brokers.holdings.noBroker", "No Broker (Unassigned)")}
                  </option>
                  {brokers.map((broker) => (
                    <option key={broker.id} value={broker.id}>
                      {broker.name}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showZeroQuantities}
                  onChange={(e) => setShowZeroQuantities(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                {t("brokers.holdings.showZero", "Show zero quantities")}
              </label>
            </div>
          </div>
        </div>

        {/* Holdings Table */}
        <div className="px-4 pb-8">
          <div className="max-w-4xl mx-auto">
            {holdings && holdings.holdings.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-check-circle text-2xl text-green-400"></i>
                </div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  {brokerId === "NO_BROKER"
                    ? t(
                        "brokers.holdings.noUnassigned",
                        "All transactions have brokers assigned",
                      )
                    : t(
                        "brokers.holdings.empty",
                        "No holdings for this broker",
                      )}
                </h2>
                <p className="text-gray-600">
                  {brokerId === "NO_BROKER"
                    ? t(
                        "brokers.holdings.noUnassignedDesc",
                        "Great! All your buy/sell transactions have a broker assigned.",
                      )
                    : t(
                        "brokers.holdings.emptyDesc",
                        "This broker has no current positions.",
                      )}
                </p>
              </div>
            ) : holdings ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <h2 className="font-semibold text-gray-900">
                        {holdings.brokerName}
                      </h2>
                      {reconciledAssets.size > 0 && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                          {t("brokers.holdings.reconciled", {
                            count: reconciledAssets.size,
                            total: holdings.holdings.length,
                            defaultValue: `${reconciledAssets.size}/${holdings.holdings.length} reconciled`,
                          })}
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-gray-600">
                      {holdings.totalHoldings !== holdings.holdings.length
                        ? t("brokers.holdings.positionsFiltered", {
                            shown: holdings.holdings.length,
                            total: holdings.totalHoldings,
                            defaultValue: `${holdings.holdings.length} of ${holdings.totalHoldings} position(s)`,
                          })
                        : t("brokers.holdings.positions", {
                            count: holdings.holdings.length,
                            defaultValue: `${holdings.holdings.length} position(s)`,
                          })}
                    </span>
                  </div>
                </div>

                {/* Desktop Table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t("asset", "Asset")}
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t("quantity", "Quantity")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {holdings.holdings.map(renderHoldingRow)}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="sm:hidden">
                  {holdings.holdings.map(renderMobileHolding)}
                </div>
              </div>
            ) : null}

            {/* Quick Links */}
            <div className="mt-6 flex flex-wrap gap-3 justify-center">
              <Link
                href="/brokers"
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                <i className="fas fa-cog mr-1"></i>
                {t("brokers.manage", "Manage Brokers")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  },
)

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
})
