import React from "react"
import Link from "next/link"
import { AssetOption, WatchlistItem } from "types/beancounter"
import {
  buildAssetLookupHref,
  getPositionDisplayName,
  isTradeable,
  priceDecimals,
  stripOwnerPrefix,
} from "@lib/assets/assetUtils"
import {
  formatCurrency,
  formatDate,
  formatPercent,
  formatSignedNumber,
  gainLossClass,
} from "@lib/formatters"
import AssetReviewButton from "@components/features/assets/AssetReviewButton"
import AssetNewsButton from "@components/features/holdings/AssetNewsButton"
import TradeAssetAction from "@components/features/transactions/TradeAssetAction"
import { isChartableCategory } from "@lib/categoryMapping"

const DASH = "–"

interface WatchlistItemsTableProps {
  items: WatchlistItem[]
  onEdit: (item: WatchlistItem) => void
  onRemove: (item: WatchlistItem) => void
  /** Open the AI review of this item's asset. */
  onReview: (item: WatchlistItem) => void
  /** Open the chart of this item's asset. */
  onChart: (item: WatchlistItem) => void
  /** Open the news and sentiment popup for this item's asset. */
  onNews: (item: WatchlistItem) => void
}

// The trade dialog takes the lookup page's AssetOption shape.
const toTradeOption = (item: WatchlistItem): AssetOption => {
  const symbol = stripOwnerPrefix(item.asset.code)
  return {
    value: item.asset.id,
    label: symbol,
    symbol,
    name: item.asset.name,
    market: item.asset.market?.code,
    assetId: item.asset.id,
    currency: item.currency.code,
  }
}

// Every figure is the backend's; this component only formats. Percent fields
// are fractions (0.25 = 25%), hence formatPercent.
const signedPercent = (value: number): string =>
  `${value > 0 ? "+" : ""}${formatPercent(value)}`

function Change({
  amount,
  percent,
  testId,
  decimals,
}: {
  amount: number | null
  percent: number | null
  testId: string
  decimals: number
}): React.ReactElement {
  if (amount == null && percent == null) {
    return <span data-testid={testId}>{DASH}</span>
  }
  const tone = gainLossClass(amount ?? percent ?? 0)
  return (
    <span data-testid={testId} className={`tabular-nums ${tone}`}>
      {amount == null ? DASH : formatSignedNumber(amount, decimals)}
      <span className="ml-1 text-xs">
        {percent == null ? `(${DASH})` : `(${signedPercent(percent)})`}
      </span>
    </span>
  )
}

/** A cell label shown only when rows stack into cards on narrow screens. */
const MobileLabel = ({
  children,
}: {
  children: string
}): React.ReactElement => (
  <span className="md:hidden text-xs text-gray-500 mr-2">{children}</span>
)

const th = "px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500"
const td = "flex justify-between md:table-cell px-3 py-1 md:py-2 md:text-right"

export default function WatchlistItemsTable({
  items,
  onEdit,
  onRemove,
  onReview,
  onChart,
  onNews,
}: WatchlistItemsTableProps): React.ReactElement {
  return (
    <table className="w-full text-sm">
      <thead className="hidden md:table-header-group border-b border-gray-200">
        <tr>
          <th className={`${th} text-left`}>{"Asset"}</th>
          <th className={`${th} text-right`}>{"Price"}</th>
          <th className={`${th} text-right`}>{"Day"}</th>
          <th className={`${th} text-right`}>{"Added"}</th>
          <th className={`${th} text-right`}>{"Since Added"}</th>
          <th className={`${th} text-right`}>{"Target"}</th>
          <th className={`${th} text-right`}>
            <span className="sr-only">{"Actions"}</span>
          </th>
        </tr>
      </thead>
      <tbody className="block md:table-row-group">
        {items.map((item) => {
          const code = getPositionDisplayName(item.asset)
          const dp = priceDecimals(item.asset)
          return (
            <tr
              key={item.id}
              data-testid={`watchlist-item-${item.id}`}
              className="block md:table-row border border-gray-200 md:border-0 md:border-b rounded-lg md:rounded-none mb-3 md:mb-0 py-2 md:py-0 bg-white"
            >
              <td className="block md:table-cell px-3 py-1 md:py-2">
                <div className="flex items-center gap-1.5">
                  <Link
                    href={buildAssetLookupHref(item.asset)}
                    className="font-semibold text-gray-900 hover:text-blue-600"
                  >
                    {code}
                  </Link>
                  <AssetNewsButton
                    asset={item.asset}
                    onShow={() => onNews(item)}
                  />
                  <AssetReviewButton
                    asset={item.asset}
                    onShow={() => onReview(item)}
                  />
                  {isChartableCategory(item.asset.assetCategory?.id) && (
                    <button
                      type="button"
                      aria-label={`Show price chart for ${code}`}
                      title="Price Chart"
                      onClick={() => onChart(item)}
                      className="text-gray-400 hover:text-blue-600 transition-colors"
                    >
                      <i aria-hidden="true" className="fas fa-chart-line"></i>
                    </button>
                  )}
                </div>
                {item.asset.name && item.asset.name !== code && (
                  <div className="text-xs text-gray-500 truncate max-w-[16rem]">
                    {item.asset.name}
                  </div>
                )}
              </td>
              <td className={td}>
                <MobileLabel>{"Price"}</MobileLabel>
                {item.price == null ? (
                  <span data-testid="price">{DASH}</span>
                ) : (
                  <span
                    data-testid="price"
                    className="tabular-nums"
                    title={
                      item.priceDate
                        ? `As at ${formatDate(item.priceDate)}`
                        : undefined
                    }
                  >
                    {formatCurrency(item.price, dp)}
                    <span className="ml-1 text-xs text-gray-500">
                      {item.currency.code}
                    </span>
                  </span>
                )}
              </td>
              <td className={td}>
                <MobileLabel>{"Day"}</MobileLabel>
                <Change
                  testId="day-change"
                  amount={item.changeOnDay}
                  percent={item.changeOnDayPercent}
                  decimals={dp}
                />
              </td>
              <td className={td}>
                <MobileLabel>{"Added"}</MobileLabel>
                <span data-testid="added" className="tabular-nums">
                  {formatCurrency(item.addedPrice, dp)}
                  {/* The Price cell names the currency; with no price, say it here. */}
                  {item.price == null && (
                    <span className="ml-1 text-xs text-gray-500">
                      {item.currency.code}
                    </span>
                  )}
                  <span className="block text-xs text-gray-500">
                    {formatDate(item.addedOn)}
                  </span>
                </span>
              </td>
              <td className={td}>
                <MobileLabel>{"Since Added"}</MobileLabel>
                <Change
                  testId="since-added"
                  amount={item.changeSinceAdded}
                  percent={item.changeSinceAddedPercent}
                  decimals={dp}
                />
              </td>
              <td className={td}>
                <MobileLabel>{"Target"}</MobileLabel>
                {item.targetPrice == null ? (
                  <span data-testid="target">{DASH}</span>
                ) : (
                  <span data-testid="target" className="tabular-nums">
                    {formatCurrency(item.targetPrice, dp)}
                    <span
                      className={`ml-1 text-xs ${item.toTarget == null ? "text-gray-500" : gainLossClass(item.toTarget)}`}
                    >
                      {item.toTarget == null
                        ? `(${DASH})`
                        : `(${signedPercent(item.toTarget)})`}
                    </span>
                  </span>
                )}
              </td>
              <td className="flex justify-end gap-1 md:table-cell px-3 py-1 md:py-2 md:text-right whitespace-nowrap">
                {isTradeable(item.asset) && (
                  <TradeAssetAction asset={toTradeOption(item)} compact />
                )}
                <button
                  type="button"
                  aria-label={`Edit ${code}`}
                  title="Edit"
                  onClick={() => onEdit(item)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                >
                  <i aria-hidden="true" className="fas fa-pen"></i>
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${code}`}
                  title="Remove"
                  onClick={() => onRemove(item)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded text-gray-500 hover:bg-red-50 hover:text-red-600"
                >
                  <i aria-hidden="true" className="fas fa-trash"></i>
                </button>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
