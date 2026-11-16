import React, { useState, useMemo } from "react"
import useSwr, { useSWRConfig } from "swr"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import {
  Broker,
  BrokerHoldingsResponse,
  BrokerHoldingPosition,
  HoldingContract,
  Position,
} from "types/beancounter"
import { simpleFetcher } from "@utils/api/fetchHelper"
import { errorOut } from "@components/errors/ErrorOut"
import { useRouter } from "next/router"
import { rootLoader } from "@components/ui/PageLoader"
import Link from "next/link"
import WeightedSellDialog from "@components/features/brokers/WeightedSellDialog"
import { brokerTrnHoldingsKey } from "@utils/api/client/trns"
import { brokerHoldingsKey } from "@utils/api/client/holdings"
import { brokersKey } from "@utils/api/client/brokers"
import { formatQuantity } from "@lib/formatters"
import EmptyState from "@components/ui/EmptyState"

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
const COLUMN_HEADER =
  "px-4 py-2 text-xs font-medium tracking-wide text-gray-500"
const TRN_HEADER = "px-4 py-1 text-xs font-medium text-gray-500"
const SELL_BUTTON = `inline-flex items-center rounded-md border border-gray-200 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors ${FOCUS_RING}`

function quantityTone(isReconciled: boolean, quantity: number): string {
  if (isReconciled) return "text-green-700"
  return quantity < 0 ? "text-red-600" : "text-blue-600"
}

function ReconcileCheck({
  checked,
  asset,
  onToggle,
}: {
  checked: boolean
  asset: string
  onToggle: () => void
}): React.ReactElement {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={`${asset} reconciled`}
      onClick={onToggle}
      className={`group -m-1.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md ${FOCUS_RING}`}
      title={checked ? "Mark as unreconciled" : "Mark as reconciled"}
    >
      <span
        className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-colors ${
          checked
            ? "bg-green-600 border-green-600 text-white"
            : "border-gray-400 group-hover:border-green-600"
        }`}
      >
        {checked && <i className="fas fa-check text-xs" aria-hidden="true"></i>}
      </span>
    </button>
  )
}

function NoTransactions(): React.ReactElement {
  return (
    <p className="px-4 py-3 text-sm text-gray-600">
      {"No transactions are recorded against this brokerage account."}
    </p>
  )
}

export default withPageAuthRequired(
  function BrokerHoldings(): React.ReactElement {
    const router = useRouter()
    const { brokerId } = router.query
    const [expandedAsset, setExpandedAsset] = useState<string | null>(null)
    const [showZeroQuantities, setShowZeroQuantities] = useState<boolean>(false)
    const [reconciledAssets, setReconciledAssets] = useState<Set<string>>(
      new Set(),
    )
    const [sellHolding, setSellHolding] =
      useState<BrokerHoldingPosition | null>(null)
    const { mutate } = useSWRConfig()

    const { data: brokersData, error: brokersError } = useSwr(
      brokersKey,
      simpleFetcher(brokersKey),
    )

    // Fetch split-adjusted positions from svc-position
    const positionsKey =
      brokerId && typeof brokerId === "string"
        ? brokerHoldingsKey(brokerId)
        : null
    const { data: positionsData, error: positionsError } = useSwr<{
      data: HoldingContract
    }>(positionsKey, positionsKey ? simpleFetcher(positionsKey) : null)

    // Fetch transaction details from bc-data for drill-down
    const transactionsKey =
      brokerId && typeof brokerId === "string"
        ? brokerTrnHoldingsKey(brokerId)
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
        "Error loading brokerage account holdings",
        brokersError || positionsError || transactionsError,
      )
    }

    if (!brokersData || (brokerId && !positionsData)) {
      return rootLoader("Loading...")
    }

    const brokers: Broker[] = brokersData.data || []
    const holdings:
      (BrokerHoldingsResponse & { totalHoldings: number }) | null =
      mergedHoldings
    // Sell proposes SELL trns against a real broker; NO_BROKER is a UI
    // sentinel grouping unassigned transactions, not a real broker id.
    const canSell = brokerId !== "NO_BROKER"

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

    // Refresh data but leave the dialog open so its success state (with the
    // link to review proposed transactions) stays visible; onClose dismisses.
    const handleSellSubmitted = (): void => {
      if (positionsKey) mutate(positionsKey)
      if (transactionsKey) mutate(transactionsKey)
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
            className={`transition-colors ${
              isReconciled
                ? "bg-green-50 hover:bg-green-100"
                : "hover:bg-blue-50"
            }`}
          >
            <td className="px-4 py-3">
              <div className="flex items-center gap-3">
                <ReconcileCheck
                  checked={isReconciled}
                  asset={assetDisplay}
                  onToggle={() => toggleReconciled(holding.assetId)}
                />
                <div className="min-w-0">
                  <span
                    className={`font-mono text-sm font-semibold ${isReconciled ? "text-green-800" : "text-gray-900"}`}
                  >
                    {assetDisplay}
                  </span>
                  {holding.assetName && (
                    <p
                      className={`text-sm truncate max-w-xs ${isReconciled ? "text-green-700" : "text-gray-600"}`}
                      title={holding.assetName}
                    >
                      {holding.assetName}
                    </p>
                  )}
                </div>
              </div>
            </td>
            <td className="px-4 py-3 text-right">
              <button
                type="button"
                onClick={() => toggleExpand(holding.assetId)}
                aria-expanded={isExpanded}
                className={`rounded font-mono tabular-nums font-medium cursor-pointer hover:underline ${FOCUS_RING} ${quantityTone(
                  isReconciled,
                  holding.quantity,
                )}`}
                title={"Click to view transactions"}
              >
                {formatQuantity(holding.quantity)}
                <i
                  className={`fas fa-chevron-${isExpanded ? "up" : "down"} ml-2 text-xs`}
                  aria-hidden="true"
                ></i>
              </button>
            </td>
            {canSell && (
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => setSellHolding(holding)}
                  className={SELL_BUTTON}
                  title={"Sell"}
                  aria-label={`Sell ${assetDisplay}`}
                >
                  {"Sell"}
                </button>
              </td>
            )}
          </tr>

          {/* Expanded detail */}
          {isExpanded && portfolioGroups.length === 0 && (
            <tr>
              <td colSpan={canSell ? 3 : 2} className="bg-gray-50">
                <NoTransactions />
              </td>
            </tr>
          )}
          {isExpanded && portfolioGroups.length > 0 && (
            <tr>
              <td colSpan={canSell ? 3 : 2} className="px-0 py-0 bg-gray-50">
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
                          className={`font-mono tabular-nums font-semibold ${
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
                            <th
                              scope="col"
                              className={`${TRN_HEADER} text-left`}
                            >
                              {"Date"}
                            </th>
                            <th
                              scope="col"
                              className={`${TRN_HEADER} text-left`}
                            >
                              {"Type"}
                            </th>
                            <th
                              scope="col"
                              className={`${TRN_HEADER} text-right`}
                            >
                              {"Qty"}
                            </th>
                            <th
                              scope="col"
                              className={`${TRN_HEADER} text-right`}
                            >
                              {"Price"}
                            </th>
                            <th
                              scope="col"
                              className={`${TRN_HEADER} text-right`}
                            >
                              {"Amount"}
                            </th>
                            <th scope="col" className="px-4 py-1 w-10">
                              <span className="sr-only">{"Edit"}</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {pg.transactions.map((trn) => (
                            <tr key={trn.id} className="hover:bg-gray-50">
                              <td className="px-4 py-1 text-sm font-mono tabular-nums text-gray-600">
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
                              <td className="px-4 py-1 text-sm text-right font-mono tabular-nums">
                                {formatQuantity(trn.quantity)}
                              </td>
                              <td className="px-4 py-1 text-sm text-right font-mono tabular-nums text-gray-600">
                                {trn.price.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 4,
                                })}
                              </td>
                              <td className="px-4 py-1 text-sm text-right font-mono tabular-nums text-gray-600">
                                {trn.tradeAmount.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                              <td className="px-4 py-1 text-right">
                                <Link
                                  href={`/trns/trades/edit/${pg.portfolioId}/${trn.id}`}
                                  className={`inline-flex h-7 w-7 items-center justify-center rounded text-gray-500 hover:bg-gray-200 hover:text-gray-900 ${FOCUS_RING}`}
                                  title={"Edit"}
                                  aria-label={`Edit ${trn.trnType} of ${trn.tradeDate}`}
                                >
                                  <i
                                    className="far fa-edit text-sm"
                                    aria-hidden="true"
                                  ></i>
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
              <div className="flex min-w-0 items-start gap-3">
                <ReconcileCheck
                  checked={isReconciled}
                  asset={assetDisplay}
                  onToggle={() => toggleReconciled(holding.assetId)}
                />
                <div className="min-w-0">
                  <span
                    className={`font-mono text-sm font-semibold ${isReconciled ? "text-green-800" : "text-gray-900"}`}
                  >
                    {assetDisplay}
                  </span>
                  {holding.assetName && (
                    <p
                      className={`text-sm truncate max-w-[200px] ${isReconciled ? "text-green-700" : "text-gray-600"}`}
                    >
                      {holding.assetName}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => toggleExpand(holding.assetId)}
                aria-expanded={isExpanded}
                aria-label={`${formatQuantity(holding.quantity)} ${assetDisplay}, transactions`}
                className={`-my-2 shrink-0 rounded py-2 pl-2 font-mono tabular-nums font-semibold ${FOCUS_RING} ${quantityTone(
                  isReconciled,
                  holding.quantity,
                )}`}
              >
                {formatQuantity(holding.quantity)}
                <i
                  className={`fas fa-chevron-${isExpanded ? "up" : "down"} ml-2 text-xs`}
                  aria-hidden="true"
                ></i>
              </button>
            </div>
            {canSell && (
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSellHolding(holding)}
                  className={`${SELL_BUTTON} py-1.5`}
                  title={"Sell"}
                  aria-label={`Sell ${assetDisplay}`}
                >
                  {"Sell"}
                </button>
              </div>
            )}
          </div>

          {/* Expanded detail */}
          {isExpanded && portfolioGroups.length === 0 && (
            <div className="bg-gray-50 border-t border-gray-200">
              <NoTransactions />
            </div>
          )}
          {isExpanded && portfolioGroups.length > 0 && (
            <div className="bg-gray-50 border-t border-gray-200 px-4 pb-4">
              {portfolioGroups.map((pg) => (
                <div key={pg.portfolioId} className="mt-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-blue-800">
                      {pg.portfolioCode}
                    </span>
                    <span
                      className={`font-mono tabular-nums font-semibold ${
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
                        className="bg-white border border-gray-200 rounded-md py-1 pl-3 pr-1 flex justify-between items-center"
                      >
                        <div>
                          <span className="text-sm font-mono tabular-nums text-gray-600">
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
                          <span className="ml-2 font-mono tabular-nums text-sm">
                            {formatQuantity(trn.quantity)}
                          </span>
                        </div>
                        <Link
                          href={`/trns/trades/edit/${pg.portfolioId}/${trn.id}`}
                          className={`inline-flex h-10 w-10 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 ${FOCUS_RING}`}
                          aria-label={`Edit ${trn.trnType} of ${trn.tradeDate}`}
                        >
                          <i className="far fa-edit" aria-hidden="true"></i>
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
          <div className="px-4 py-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/brokers")}
              className={`-ml-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors ${FOCUS_RING}`}
              title={"Back"}
              aria-label={"Back"}
            >
              <i className="fas fa-arrow-left" aria-hidden="true"></i>
            </button>
            <h1 className="text-lg sm:text-2xl font-semibold tracking-tight text-gray-900 truncate">
              {"Brokerage Account Reconciliation"}
            </h1>
          </div>
        </div>

        {/* Broker Selector */}
        <div className="px-4 py-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <label
                  htmlFor="reconcile-broker"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  {"Select Brokerage Account"}
                </label>
                <select
                  id="reconcile-broker"
                  value={brokerId as string}
                  onChange={(e) => handleBrokerChange(e.target.value)}
                  className="input-height w-full sm:w-64 border border-gray-300 rounded-md px-3 text-base sm:text-sm text-gray-900 bg-white transition-colors focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                >
                  <option value="NO_BROKER">{"No Account (Unassigned)"}</option>
                  {brokers.map((broker) => (
                    <option key={broker.id} value={broker.id}>
                      {broker.name}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 py-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showZeroQuantities}
                  onChange={(e) => setShowZeroQuantities(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-400 text-blue-600 focus:ring-blue-500"
                />
                {"Show zero quantities"}
              </label>
            </div>
          </div>
        </div>

        {/* Holdings Table */}
        <div className="px-4 pb-8">
          <div className="max-w-4xl mx-auto">
            {holdings && holdings.holdings.length === 0 ? (
              <EmptyState
                icon="fas fa-check-circle"
                title={
                  brokerId === "NO_BROKER"
                    ? "All transactions have brokerage accounts assigned"
                    : "No holdings for this brokerage account"
                }
                description={
                  brokerId === "NO_BROKER"
                    ? "Every buy and sell transaction names a brokerage account."
                    : "This brokerage account has no current positions."
                }
              />
            ) : holdings ? (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 flex flex-wrap justify-between items-baseline gap-x-4 gap-y-1">
                  <div className="flex items-center gap-3 min-w-0">
                    <h2 className="text-lg font-semibold text-gray-900 truncate">
                      {holdings.brokerName}
                    </h2>
                    {reconciledAssets.size > 0 && (
                      <span className="shrink-0 text-xs font-medium tabular-nums bg-green-100 text-green-800 px-2 py-0.5 rounded">
                        {`${reconciledAssets.size} reconciled`}
                      </span>
                    )}
                  </div>
                  <span className="text-sm tabular-nums text-gray-600">
                    {holdings.totalHoldings !== holdings.holdings.length
                      ? `${holdings.holdings.length} of ${holdings.totalHoldings} positions`
                      : `${holdings.holdings.length} positions`}
                  </span>
                </div>

                {/* Desktop Table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th
                          scope="col"
                          className={`${COLUMN_HEADER} text-left`}
                        >
                          {"Asset"}
                        </th>
                        <th
                          scope="col"
                          className={`${COLUMN_HEADER} text-right`}
                        >
                          {"Qty"}
                        </th>
                        {canSell && (
                          <th
                            scope="col"
                            className={`${COLUMN_HEADER} text-right`}
                          >
                            <span className="sr-only">{"Actions"}</span>
                          </th>
                        )}
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
                className={`rounded text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline ${FOCUS_RING}`}
              >
                {"Manage brokerage accounts"}
              </Link>
            </div>
          </div>
        </div>

        {sellHolding && (
          <WeightedSellDialog
            open={true}
            onClose={() => setSellHolding(null)}
            brokerId={String(brokerId)}
            brokerName={holdings?.brokerName || String(brokerId)}
            holding={sellHolding}
            onSubmitted={handleSellSubmitted}
          />
        )}
      </div>
    )
  },
)
