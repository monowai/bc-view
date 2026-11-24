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

/** A move as its percent, or its amount when the backend sent no percent. */
function signedMove(
  amount: number | null,
  percent: number | null,
  decimals: number,
): { text: string; tone: string } | null {
  if (percent != null) {
    return { text: formatSignedPercent(percent), tone: gainLossClass(percent) }
  }
  if (amount != null) {
    return {
      text: formatSignedNumber(amount, decimals),
      tone: gainLossClass(amount),
    }
  }
  return null
}

/**
 * The day's move as a percent, the amount on hover, as on holdings. With no
 * percent from the backend, the amount shows instead.
 */
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
  const move = signedMove(amount, percent, decimals)
  return (
    <span
      data-testid="day-change"
      title={title}
      className={move ? `tabular-nums ${move.tone}` : undefined}
    >
      {move ? move.text : DASH}
    </span>
  )
}

/**
 * The move since added as text: hover titles reach neither touch screens nor
 * screen readers. Visible on stacked cards, screen-reader-only on desktop.
 */
function SinceAdded({
  item,
  decimals,
}: {
  item: WatchlistItem
  decimals: number
}): React.ReactElement | null {
  const move = signedMove(
    item.changeSinceAdded,
    item.changeSinceAddedPercent,
    decimals,
  )
  if (!move) return null
  return (
    <span
      data-testid="since-added"
      className={`md:sr-only ml-1 text-xs tabular-nums ${move.tone}`}
    >
      {`(${move.text})`}
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
          <th className={`${th} w-full text-left`}>{"Asset"}</th>
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
                <div
                  data-testid="row-actions"
                  className="mt-1 -ml-2 flex items-center"
                >
                  {/* An empty group hides, taking its divider with it. */}
                  <span
                    data-testid="asset-icons"
                    className="flex items-center empty:hidden mr-1.5 pr-1.5 border-r border-gray-300"
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
                  <span className="flex items-center">
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
                <span>
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
                  <SinceAdded item={item} decimals={dp} />
                </span>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
