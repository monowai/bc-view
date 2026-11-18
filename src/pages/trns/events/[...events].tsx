import React, { useCallback, useMemo } from "react"
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
  TrnNumber,
  TrnNumberCell,
  TrnPageNav,
  TrnRowActions,
  TrnStatusBadge,
  TrnTableHead,
  TrnTypeBadge,
  useTrnTabSignals,
} from "@components/features/transactions/TrnListParts"
import { useTrnListDelete } from "@components/features/transactions/useTrnListDelete"
import {
  anyNonZero,
  groupByYear,
  settlementLabel,
  uniformCurrency,
} from "@utils/trns/trnListView"

const CELL = "px-3 py-2"
const NUM_CELL = `${CELL} text-right whitespace-nowrap`

/**
 * Columns fit the page without sideways scrolling: the currency every event
 * shares moves into the Amount header, and Tax shows only when some event was
 * taxed.
 */
function eventColumns(
  currency: string | undefined,
  showTax: boolean,
): TrnColumn[] {
  return [
    { label: "Date" },
    { label: "Type" },
    ...(currency ? [] : [{ label: "Currency" }]),
    { label: "Units", align: "right" as const },
    { label: "Per unit", align: "right" as const },
    { label: "Amount", align: "right" as const, hint: currency },
    ...(showTax ? [{ label: "Tax", align: "right" as const }] : []),
    { label: "Settled to" },
    { label: "Status" },
    { label: "Actions", align: "right" as const, srOnly: true },
  ]
}

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
  const signals = useTrnTabSignals(portfolioId, assetId)

  const trnResults = useMemo(
    (): Transaction[] => events.data?.data || [],
    [events.data?.data],
  )
  const years = useMemo(() => groupByYear(trnResults), [trnResults])
  const currency = uniformCurrency(trnResults)
  const showTax = anyNonZero(trnResults, "tax")
  const columns = eventColumns(currency, showTax)
  const grandTotal = years.reduce(
    (sum, y) => ({
      tradeAmount: sum.tradeAmount + y.totals.tradeAmount,
      tax: sum.tax + y.totals.tax,
    }),
    { tradeAmount: 0, tax: 0 },
  )
  const editTrn = (trn: Transaction): void => {
    router.push(`/trns/trades/edit/${trn.portfolio.id}/${trn.id}`)
  }

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
  const hasEvents = trnResults.length > 0
  // Columns before Amount, so the year label and totals line up under it.
  const leadColumns = currency ? 4 : 5
  const trailColumns = 3

  return (
    <div className="min-h-screen bg-gray-50 text-sm">
      <TrnPageNav
        title={asset.data.data.name}
        subtitle={asset.data.data.market.code}
      />

      <TrnDetailTabs
        active="events"
        portfolioId={portfolioId}
        assetId={assetId}
        signals={signals}
      />

      <div className="container mx-auto px-4 py-4">
        {!hasEvents ? (
          <TrnEmptyState
            title={"No events for this holding"}
            description={
              "Dividends, splits and other corporate actions appear here once they are recorded against this portfolio."
            }
          />
        ) : (
          <>
            {/* Narrow screens: cards, grouped by year */}
            <div className="lg:hidden space-y-4">
              {years.map((group) => (
                <section key={group.year}>
                  <div className="flex items-baseline justify-between px-1 pb-1.5">
                    <h2 className="font-semibold text-gray-900">
                      {group.year}
                    </h2>
                    <span className="text-xs text-gray-500">
                      <TrnNumber value={group.totals.tradeAmount} scale={2} />
                      {currency && ` ${currency}`}
                    </span>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
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
                          </div>
                          <TrnStatusBadge status={trn.status} />
                        </div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                          <TrnCardValue
                            label={"Amount"}
                            value={trn.tradeAmount}
                            scale={2}
                            valueClassName="ml-1 font-semibold text-gray-900"
                          />
                          <TrnCardValue
                            label={"Tax"}
                            value={trn.tax}
                            scale={2}
                            blankZero
                          />
                          <TrnCardValue
                            label={"Units"}
                            value={trn.quantity}
                            scale={0}
                            fixed={false}
                          />
                          <TrnCardValue
                            label={"Per unit"}
                            value={trn.price}
                            scale={2}
                            fixed={false}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            {/* Wide screens: one table, a band per year with its totals */}
            <div className="hidden lg:block bg-white rounded-lg border border-gray-200 overflow-x-auto">
              <table className="min-w-full">
                <TrnTableHead columns={columns} cellClassName={CELL} />
                {years.map((group) => (
                  <tbody key={group.year} className="divide-y divide-gray-100">
                    <tr className="bg-gray-50/70 border-t border-gray-200">
                      <th
                        scope="rowgroup"
                        colSpan={leadColumns}
                        className={`${CELL} text-left font-semibold text-gray-900`}
                      >
                        {group.year}
                        <span className="ml-2 text-xs font-normal text-gray-500">
                          {group.transactions.length}{" "}
                          {group.transactions.length === 1 ? "event" : "events"}
                        </span>
                      </th>
                      <TrnNumberCell
                        value={group.totals.tradeAmount}
                        scale={2}
                        className={`${NUM_CELL} font-semibold text-gray-900`}
                      />
                      {showTax && (
                        <TrnNumberCell
                          value={group.totals.tax}
                          scale={2}
                          blankZero
                          className={`${NUM_CELL} font-medium text-gray-600`}
                        />
                      )}
                      <td colSpan={trailColumns}></td>
                    </tr>
                    {group.transactions.map((trn: Transaction) => (
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
                        {!currency && (
                          <td className={`${CELL} whitespace-nowrap`}>
                            {trn.tradeCurrency.code}
                          </td>
                        )}
                        <TrnNumberCell
                          value={trn.quantity}
                          scale={0}
                          fixed={false}
                          blankZero
                          className={`${NUM_CELL} text-gray-600`}
                        />
                        <TrnNumberCell
                          value={trn.price}
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
                        {showTax && (
                          <TrnNumberCell
                            value={trn.tax}
                            scale={2}
                            blankZero
                            className={`${NUM_CELL} text-gray-600`}
                          />
                        )}
                        <td
                          className={`${CELL} text-gray-600 max-w-[12rem] truncate`}
                          title={trn.comments || undefined}
                        >
                          {settlementLabel(trn) ?? (
                            <span className="text-gray-300">{"–"}</span>
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
                    ))}
                  </tbody>
                ))}
                <tfoot className="bg-indigo-50 border-t-2 border-indigo-200">
                  <tr className="font-semibold text-indigo-900">
                    <td className={CELL} colSpan={leadColumns}>
                      {"Total"}
                    </td>
                    <TrnNumberCell
                      value={grandTotal.tradeAmount}
                      scale={2}
                      className={NUM_CELL}
                    />
                    {showTax && (
                      <TrnNumberCell
                        value={grandTotal.tax}
                        scale={2}
                        className={NUM_CELL}
                      />
                    )}
                    <td colSpan={trailColumns}></td>
                  </tr>
                </tfoot>
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
