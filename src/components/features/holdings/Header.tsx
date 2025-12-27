import React, { ReactElement } from "react"
import { GroupKey } from "types/beancounter"
import { useTranslation } from "next-i18next"
import { useHoldingState } from "@lib/holdings/holdingState"

// Header column indices for consistent mapping
export const HEADER_INDICES = {
  PRICE: 0, // asset.price
  CHANGE: 1, // asset.change
  GAIN_ON_DAY: 2, // gain.onday
  QUANTITY: 3, // quantity
  COST: 4, // cost
  MARKET_VALUE: 5, // summary.value
  WEIGHT: 6, // weight (moved between value and income)
  DIVIDENDS: 7, // summary.dividends
  UNREALISED_GAIN: 8, // gain.unrealised
  REALISED_GAIN: 9, // gain.realised
  IRR: 10, // irr
  ALPHA: 11, // alpha
  TOTAL_GAIN: 12, // gain
} as const

type SortConfig = {
  key: string | null
  direction: "asc" | "desc"
}

interface HeaderProps extends GroupKey {
  sortConfig?: SortConfig
  onSort?: (key: string) => void
  cumulativePositionCount?: number // Cumulative positions displayed before this group
  isFirstGroup?: boolean // Always show headers for first group
}

export const headers = [
  {
    key: "asset.price",
    align: "left",
    mobile: false, // Hidden on mobile to prevent horizontal scrolling
    medium: true,
    sortable: true,
    sortKey: "price",
  },
  {
    key: "asset.change",
    align: "right",
    mobile: true,
    medium: true,
    sortable: true,
    sortKey: "changePercent",
  },
  {
    key: "gain.onday",
    align: "right",
    mobile: false, // Hidden completely - value shown in Change % tooltip and summary
    medium: false, // Hidden on tablet
    hidden: true, // Hidden on all screens including desktop
    sortable: true,
    sortKey: "gainOnDay",
  },
  {
    key: "quantity",
    align: "right",
    mobile: false, // Hidden on mobile to prevent horizontal scrolling
    medium: true,
    sortable: true,
    sortKey: "quantity",
  },
  {
    key: "cost",
    align: "right",
    mobile: false,
    medium: true,
    sortable: true,
    sortKey: "costValue",
    costRelated: true, // Shows warning when display currency differs from value in
  },
  {
    key: "summary.value",
    align: "right",
    mobile: true,
    medium: true,
    sortable: true,
    sortKey: "marketValue",
  },
  {
    key: "weight",
    align: "right",
    mobile: true, // Visible on mobile - important for portfolio balance view
    medium: true,
    sortable: true,
    sortKey: "weight",
  },
  {
    key: "summary.dividends",
    align: "right",
    mobile: false,
    medium: true,
    sortable: true,
    sortKey: "dividends",
  },
  {
    key: "gain.unrealised",
    align: "right",
    mobile: false,
    medium: false,
    sortable: true,
    sortKey: "unrealisedGain",
    costRelated: true,
  },
  {
    key: "gain.realised",
    align: "right",
    mobile: false,
    medium: false,
    sortable: true,
    sortKey: "realisedGain",
    costRelated: true,
  },
  {
    key: "irr",
    align: "right",
    mobile: true,
    medium: true,
    sortable: true,
    sortKey: "irr",
  },
  {
    key: "alpha",
    align: "center",
    mobile: false,
    medium: false,
    sortable: false,
    sortKey: "",
  },
  {
    key: "gain",
    align: "right",
    mobile: false, // Hidden on mobile portrait to save space
    medium: true,
    sortable: true,
    sortKey: "totalGain",
    costRelated: true,
  },
]

// Show column headers every N positions
const HEADER_INTERVAL = 6

export default function Header({
  groupKey,
  sortConfig,
  onSort,
  cumulativePositionCount = 0,
  isFirstGroup = false,
}: HeaderProps): ReactElement {
  const { t } = useTranslation("common")
  const holdingState = useHoldingState()
  const isCostApproximate = holdingState.isCostApproximate

  // Show headers for first group, or every HEADER_INTERVAL positions
  const showColumnHeaders =
    isFirstGroup || cumulativePositionCount % HEADER_INTERVAL === 0

  const getSortIcon = (headerKey: string): React.ReactElement => {
    if (!sortConfig || sortConfig.key !== headerKey) {
      return <span className="ml-1 text-gray-400">↕</span>
    }
    return sortConfig.direction === "asc" ? (
      <span className="ml-1 text-blue-600">↑</span>
    ) : (
      <span className="ml-1 text-blue-600">↓</span>
    )
  }

  // Get optimized header padding to match data cell padding for mobile space efficiency
  const getHeaderPadding = (headerIndex: number): string => {
    // Apply same logic as data cells for mobile-visible columns
    const isChangeColumn = headerIndex === 1
    const isMarketValueColumn = headerIndex === 5
    const isIrrColumn = headerIndex === 9
    const isWeightColumn = headerIndex === 11

    if (
      isChangeColumn ||
      isMarketValueColumn ||
      isIrrColumn ||
      isWeightColumn
    ) {
      return "px-0.5 py-1 sm:px-1 md:px-2 xl:px-3" // Minimal padding on portrait for breathing room
    }
    return "px-0.5 py-1 sm:px-1 md:px-2 xl:px-3" // Minimal padding on portrait for breathing room
  }

  return (
    <thead className="bg-gray-100">
      <tr className="border-t-2 border-b-2 border-gray-400">
        <th
          className={`px-0.5 py-1 sm:px-2 md:px-3 text-left text-sm font-medium ${
            onSort && showColumnHeaders
              ? "cursor-pointer hover:bg-gray-200 transition-colors select-none"
              : ""
          }`}
          colSpan={showColumnHeaders ? 1 : headers.length + 1}
          onClick={
            onSort && showColumnHeaders ? () => onSort("assetName") : undefined
          }
        >
          <div className="flex items-center justify-start">
            {groupKey}
            {onSort && showColumnHeaders && getSortIcon("assetName")}
          </div>
        </th>
        {showColumnHeaders &&
          headers.map((header, index) => {
            let visibility
            if ("hidden" in header && header.hidden) {
              visibility = "hidden" // Hidden on all screens
            } else if (header.mobile) {
              visibility = ""
            } else if (header.medium) {
              visibility = "hidden sm:table-cell" // Hidden on mobile portrait, visible on landscape (640px+)
            } else {
              visibility = "hidden xl:table-cell"
            }

            return (
              <th
                key={header.key}
                className={`${getHeaderPadding(index)} text-sm font-medium ${
                  header.align === "right"
                    ? "text-right"
                    : header.align === "center"
                      ? "text-center"
                      : "text-left"
                } ${visibility} ${
                  header.sortable && onSort
                    ? "cursor-pointer hover:bg-gray-200 transition-colors select-none"
                    : ""
                }`}
                onClick={
                  header.sortable && onSort
                    ? () => onSort(header.sortKey)
                    : undefined
                }
              >
                <div
                  className={`flex items-center ${
                    header.align === "right"
                      ? "justify-end"
                      : header.align === "center"
                        ? "justify-center"
                        : "justify-start"
                  }`}
                >
                  {t(header.key)}
                  {"costRelated" in header &&
                    header.costRelated &&
                    isCostApproximate && (
                      <span
                        className="ml-1 text-amber-500 text-xs"
                        title={t("displayCurrency.approximate")}
                      >
                        ⚠
                      </span>
                    )}
                  {header.sortable && onSort && getSortIcon(header.sortKey)}
                </div>
              </th>
            )
          })}
      </tr>
    </thead>
  )
}
