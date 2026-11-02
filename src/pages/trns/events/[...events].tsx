import React, { useCallback } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { useRouter } from "next/router"
import { Transaction } from "types/beancounter"
import useSwr from "swr"
import { errorOut } from "@components/errors/ErrorOut"
import { assetKey, eventKey, simpleFetcher } from "@utils/api/fetchHelper"
import { rootLoader } from "@components/ui/PageLoader"
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
} from "@components/features/transactions/TrnListParts"
import { useTrnListDelete } from "@components/features/transactions/useTrnListDelete"

const COLUMNS: TrnColumn[] = [
  { label: "Type" },
  { label: "Currency" },
  { label: "Trade Date" },
  { label: "Amount", align: "right" },
  { label: "Tax", align: "right" },
  { label: "Affected Quantity", align: "right" },
  { label: "Per Unit", align: "right" },
  { label: "Settlement Account" },
  { label: "Status" },
  { label: "Actions", align: "center" },
]

export default withPageAuthRequired(function Events(): React.ReactElement {
  const router = useRouter()
  // Extract query params - safe to access even before router is ready (will be undefined)
  const eventsParam = router.query.events as string[] | undefined
  const portfolioId = eventsParam ? eventsParam[0] : undefined
  const assetId = eventsParam ? eventsParam[1] : undefined

  // Fetch asset and events - only when router is ready and we have valid params
  const asset = useSwr(
    router.isReady && assetId ? assetKey(assetId) : null,
    router.isReady && assetId ? simpleFetcher(assetKey(assetId)) : null,
  )
  const events = useSwr(
    router.isReady && portfolioId && assetId
      ? eventKey(portfolioId, assetId)
      : null,
    router.isReady && portfolioId && assetId
      ? simpleFetcher(eventKey(portfolioId, assetId))
      : null,
  )

  const { deletePending, requestDelete, cancelDelete, confirmDelete } =
    useTrnListDelete(events.mutate)

  // Copy row data to clipboard as tab-separated values
  const copyRowToClipboard = useCallback(
    (trn: Transaction, e: React.MouseEvent) => {
      e.stopPropagation()
      const row = [
        trn.tradeDate,
        trn.trnType,
        trn.tradeCurrency.code,
        trn.tradeAmount?.toFixed(2) || "",
        trn.tax?.toFixed(2) || "",
        trn.quantity?.toFixed(0) || "",
        trn.price?.toFixed(2) || "",
      ].join("\t")
      navigator.clipboard.writeText(row)
    },
    [],
  )

  // Wait for router to be ready (query params available) during client-side navigation
  if (!router.isReady) {
    return rootLoader("Loading...")
  }
  if (events.error) {
    return errorOut("Error retrieving events for the asset", events.error)
  }
  if (asset.error) {
    return errorOut("Error retrieving asset information", asset.error)
  }
  if (asset.isLoading) {
    return rootLoader("Loading...")
  }
  if (events.isLoading) {
    return rootLoader("Loading...")
  }
  if (!portfolioId || !assetId) {
    return errorOut(
      "Invalid URL: missing portfolio or asset parameters",
      new Error("Missing URL parameters"),
    )
  }
  const trnResults = events.data.data
  const hasEvents = trnResults && trnResults.length > 0

  return (
    <div className="min-h-screen bg-gray-50 text-sm">
      {/* Header with back button */}
      <TrnPageNav
        title={asset.data.data.name}
        subtitle={asset.data.data.market.code}
      />

      {/* Tabs for switching between Trades and Events */}
      <TrnDetailTabs
        active="events"
        portfolioId={portfolioId}
        assetId={assetId}
      />

      <div className="container mx-auto px-4 py-4">
        {!hasEvents ? (
          <TrnEmptyState />
        ) : (
          <>
            {/* Mobile: Card layout */}
            <div className="md:hidden space-y-3">
              {trnResults.map((trn: Transaction) => (
                <div
                  key={trn.id}
                  className="bg-white rounded-lg shadow p-4 space-y-2 cursor-pointer hover:shadow-md transition-shadow"
                  onDoubleClick={() =>
                    router.push(
                      `/trns/trades/edit/${trn.portfolio.id}/${trn.id}`,
                    )
                  }
                  title={"Double-click to edit"}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                        {trn.trnType}
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
                    <TrnCardValue
                      label={"Amount"}
                      value={trn.tradeAmount}
                      scale={2}
                    />
                    <TrnCardValue
                      label={"Affected Quantity"}
                      value={trn.quantity}
                      scale={0}
                      fixed={false}
                    />
                    <TrnCardValue
                      label={"Per Unit"}
                      value={trn.price}
                      scale={2}
                      fixed={false}
                    />
                    <TrnCardValue
                      label={"Tax"}
                      value={trn.tax}
                      scale={2}
                      fixed={false}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: Table layout */}
            <div className="hidden md:block bg-white rounded-lg shadow overflow-x-auto">
              <table className="min-w-full">
                <TrnTableHead columns={COLUMNS} />
                <tbody className="divide-y divide-gray-200">
                  {trnResults.map((trn: Transaction) => (
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
                      <td className="px-4 py-3 whitespace-nowrap">
                        {trn.tradeCurrency.code}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {trn.tradeDate}
                      </td>
                      <TrnNumberCell value={trn.tradeAmount} scale={2} />
                      <TrnNumberCell value={trn.tax} scale={2} />
                      <TrnNumberCell value={trn.quantity} scale={0} />
                      <TrnNumberCell value={trn.price} scale={2} />
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {["ADD", "REDUCE", "SPLIT"].includes(trn.trnType)
                          ? "-"
                          : trn.cashAsset?.market?.code === "CASH"
                            ? trn.cashAsset.name ||
                              `${trn.cashAsset.code} Balance`
                            : trn.cashAsset?.name ||
                              trn.cashAsset?.code ||
                              `${(trn.cashCurrency as any)?.code || trn.tradeCurrency?.code} Balance`}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <TrnStatusBadge status={trn.status} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <TrnRowActions
                          onEdit={() =>
                            router.push(
                              `/trns/trades/edit/${trn.portfolio.id}/${trn.id}`,
                            )
                          }
                          onCopy={(e) => copyRowToClipboard(trn, e)}
                          onDelete={() => requestDelete(trn)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      {deletePending && (
        <TrnDeleteConfirm onConfirm={confirmDelete} onCancel={cancelDelete} />
      )}
    </div>
  )
})
