import React, { forwardRef } from "react"
import { useHoldingState } from "@lib/holdings/holdingState"
import { getSortIcon } from "@lib/sortIcon"

// Header column indices for consistent mapping
export const HEADER_INDICES = {
  PRICE: 0, // asset.price
  CHANGE: 1, // asset.change
  GAIN_ON_DAY: 2, // gain.onday
  QUANTITY: 3, // quantity
  COST: 4, // cost
  MARKET_VALUE: 5, // summary.value
  IRR: 6, // irr (swapped with weight)
  DIVIDENDS: 7, // summary.dividends
  UNREALISED_GAIN: 8, // gain.unrealised
  REALISED_GAIN: 9, // gain.realised
  WEIGHT: 10, // weight (swapped with irr)
  ALPHA: 11, // alpha
  TOTAL_GAIN: 12, // gain
} as const

type SortConfig = {
  key: string | null
  direction: "asc" | "desc"
}

interface ColumnHeaderProps {
  sortConfig?: SortConfig
  onSort?: (key: string) => void
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
    key: "irr",
    align: "right",
    mobile: true,
    medium: true,
    sortable: true,
    sortKey: "irr",
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
    key: "weight",
    align: "right",
    mobile: false,
    medium: true,
    sortable: true,
    sortKey: "weight",
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

const HEADER_LABELS: Record<string, string> = {
  "asset.price": "Price",
  "asset.change": "Change",
  "gain.onday": "Change",
  quantity: "Qty",
  cost: "Cost",
  "summary.value": "Value",
  irr: "IRR",
  "summary.dividends": "Income",
  "gain.unrealised": "Unrealised",
  "gain.realised": "Realised",
  weight: "Weight",
  alpha: "Alpha",
  gain: "Gain",
}

/**
 * Shared, sticky column-header row for the holdings table.
 *
 * One instance is rendered per table (not per group), so the column labels
 * stay pinned to the top of the scroll container while the user scrolls
 * through every section. The per-group name + collapse toggle live in
 * {@link GroupBar}, which sticks just beneath this header. Forwarding the ref
 * lets the page measure this header's height to offset the group bars.
 */
const ColumnHeader = forwardRef<HTMLTableSectionElement, ColumnHeaderProps>(
  function ColumnHeader({ sortConfig, onSort }, ref) {
    const holdingState = useHoldingState()
    const isCostApproximate = holdingState.isCostApproximate

    const renderSortIcon = (headerKey: string): React.ReactElement =>
      getSortIcon(headerKey, sortConfig, "holdings")

    // Header padding matches data-cell padding for mobile space efficiency
    const headerPadding = "px-0.5 py-1.5 sm:px-1 md:px-2 xl:px-3"

    return (
      <thead
        ref={ref}
        className="sticky top-0 z-30 bg-blue-100 text-blue-700 shadow-sm"
      >
        <tr className="border-b border-blue-200">
          <th
            className={`px-1 py-1.5 sm:px-2 md:px-3 text-left text-xs uppercase tracking-wider font-medium ${
              onSort
                ? "cursor-pointer hover:bg-blue-200/50 transition-colors select-none"
                : ""
            }`}
            onClick={onSort ? () => onSort("assetName") : undefined}
          >
            <div className="flex items-center justify-start gap-1">
              Asset
              {onSort && renderSortIcon("assetName")}
            </div>
          </th>
          {headers.map((header) => {
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
                className={`${headerPadding} text-xs uppercase tracking-wider font-medium ${
                  header.align === "right"
                    ? "text-right"
                    : header.align === "center"
                      ? "text-center"
                      : "text-left"
                } ${visibility} ${
                  header.sortable && onSort
                    ? "cursor-pointer hover:bg-blue-200/50 transition-colors select-none"
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
                  {HEADER_LABELS[header.key] ?? header.key}
                  {"costRelated" in header &&
                    header.costRelated &&
                    isCostApproximate && (
                      <span
                        className="ml-1 text-amber-500 text-xs"
                        title={
                          "Values shown in display currency - Cost/Gains are approximate"
                        }
                      >
                        ⚠
                      </span>
                    )}
                  {header.sortable && onSort && renderSortIcon(header.sortKey)}
                </div>
              </th>
            )
          })}
        </tr>
      </thead>
    )
  },
)

export default ColumnHeader
