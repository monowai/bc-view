import React from "react"
import Link from "next/link"
import { AssetOption, WatchlistItem } from "types/beancounter"
import {
  buildAssetLookupHref,
  getPositionDisplayName,
  isTradeable,
  priceDecimals,
} from "@lib/assets/assetUtils"
import {
  formatCurrency,
  formatDate,
  formatSignedNumber,
  formatSignedPercent,
  gainLossClass,
} from "@lib/formatters"
import AssetReviewButton from "@components/features/assets/AssetReviewButton"
import AssetNewsButton from "@components/features/assets/AssetNewsButton"
import { ROW_ICON_BUTTON } from "@components/features/assets/iconButtonClasses"
import TargetDistance from "./TargetDistance"
import TargetHitBadge from "./TargetHitBadge"
import TradeAssetAction from "@components/features/transactions/TradeAssetAction"

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
  const symbol = item.asset.displayCode
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
// are fractions (0.25 = 25%), hence formatSignedPercent.

/** The day's move as a percent; the amount is on hover, as on holdings. */
function DayChange({
  item,
  decimals,
}: {
  item: WatchlistItem
  decimals: number
}): React.ReactElement {
  const { changeOnDay: amount, changeOnDayPercent: percent } = item
  const title =
    amount == null
      ? undefined
      : `Change on day ${formatSignedNumber(amount, decimals)}`
  if (percent == null) {
    return (
      <span data-testid="day-change" title={title}>
        {DASH}
      </span>
    )
  }
  return (
    <span
      data-testid="day-change"
      title={title}
      className={`tabular-nums ${gainLossClass(percent)}`}
    >
      {formatSignedPercent(percent)}
    </span>
  )
}

/** When the item was added and how far the price has moved since. */
function addedTitle(item: WatchlistItem, decimals: number): string {
  const added = `Added ${formatDate(item.addedOn)}`
  const { changeSinceAdded: amount, changeSinceAddedPercent: percent } = item
  if (amount == null) return added
  const pct = percent == null ? DASH : formatSignedPercent(percent)
  return `${added} · ${formatSignedNumber(amount, decimals)} (${pct})`
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
const td =
  "flex justify-between md:table-cell px-3 md:pl-8 py-1 md:py-2 md:text-right md:font-mono md:whitespace-nowrap"

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
          {/* Actions take the slack, so they hug the asset and the
              figures stay together on the right. */}
          <th className={`${th} w-full text-left`}>
            <span className="sr-only">{"Actions"}</span>
          </th>
          <th className={`${th} pl-8 text-right`}>{"Price"}</th>
          <th className={`${th} pl-8 text-right`}>{"Target"}</th>
          <th className={`${th} pl-8 text-right`}>{"Day"}</th>
          <th className={`${th} pl-8 text-right`}>{"Added"}</th>
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
              <td className="block md:table-cell px-3 py-1 md:py-2 md:whitespace-nowrap">
                <div>
                  <Link
                    href={buildAssetLookupHref(item.asset)}
                    className="font-semibold text-gray-900 hover:text-blue-700"
                  >
                    {code}
                  </Link>
                </div>
                {item.asset.name && item.asset.name !== code && (
                  <div className="text-xs text-gray-500 truncate max-w-[16rem]">
                    {item.asset.name}
                  </div>
                )}
                {item.targetHitOn && (
                  <TargetHitBadge hitOn={item.targetHitOn} className="mt-1" />
                )}
              </td>
              <td className="block md:table-cell px-3 py-1 md:py-2">
                <div data-testid="row-actions" className="flex items-center">
                  {/* On a phone an empty group hides, taking its divider with it. On
                      desktop it keeps its width so every row's icons line up. */}
                  <span
                    data-testid="asset-icons"
                    className="flex items-center empty:hidden md:empty:flex md:w-[6.375rem] md:justify-end mr-1.5 pr-1.5 border-r border-gray-300"
                  >
                    <AssetNewsButton
                      asset={item.asset}
                      onShow={() => onNews(item)}
                      buttonClassName={ROW_ICON_BUTTON}
                      iconClassName=""
                    />
                    <AssetReviewButton
                      asset={item.asset}
                      onShow={() => onReview(item)}
                      buttonClassName={ROW_ICON_BUTTON}
                      iconClassName=""
                    />
                    {item.asset.chartable && (
                      <button
                        type="button"
                        aria-label={`Show price chart for ${code}`}
                        title="Price Chart"
                        onClick={() => onChart(item)}
                        className={`${ROW_ICON_BUTTON} hover:text-blue-700`}
                      >
                        <i aria-hidden="true" className="fas fa-chart-line"></i>
                      </button>
                    )}
                  </span>
                  {/* Right-aligned in a fixed width: Edit and Remove keep
                      their place when an asset cannot be traded. */}
                  <span className="flex items-center md:w-24 md:justify-end">
                    {isTradeable(item.asset) && (
                      <TradeAssetAction asset={toTradeOption(item)} compact />
                    )}
                    <button
                      type="button"
                      aria-label={`Edit ${code}`}
                      title="Edit"
                      onClick={() => onEdit(item)}
                      className={`${ROW_ICON_BUTTON} hover:bg-gray-100 hover:text-gray-700`}
                    >
                      <i aria-hidden="true" className="fas fa-pen"></i>
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${code}`}
                      title="Remove"
                      onClick={() => onRemove(item)}
                      className={`${ROW_ICON_BUTTON} hover:bg-red-50 hover:text-red-700`}
                    >
                      <i aria-hidden="true" className="fas fa-trash"></i>
                    </button>
                  </span>
                </div>
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
                <MobileLabel>{"Target"}</MobileLabel>
                {item.targetPrice == null ? (
                  <span data-testid="target">{DASH}</span>
                ) : (
                  <span data-testid="target" className="tabular-nums">
                    {formatCurrency(item.targetPrice, dp)}
                    {item.toTarget == null ? (
                      <span className="ml-1 text-xs text-gray-500">{`(${DASH})`}</span>
                    ) : (
                      <TargetDistance
                        toTarget={item.toTarget}
                        className="ml-1 text-xs"
                      />
                    )}
                  </span>
                )}
              </td>
              <td className={td}>
                <MobileLabel>{"Day"}</MobileLabel>
                <DayChange item={item} decimals={dp} />
              </td>
              <td className={td}>
                <MobileLabel>{"Added"}</MobileLabel>
                <span
                  data-testid="added"
                  title={addedTitle(item, dp)}
                  className="tabular-nums"
                >
                  {formatCurrency(item.addedPrice, dp)}
                  {/* The Price cell names the currency; with no price, say it here. */}
                  {item.price == null && (
                    <span className="ml-1 text-xs text-gray-500">
                      {item.currency.code}
                    </span>
                  )}
                </span>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
