import { headers } from "@components/features/holdings/Header"

// Numeric column indices for Rows (detail rows)
const ROWS_NUMERIC_INDICES = new Set([
  0, // price
  3, // quantity
  4, // cost
  5, // market value
  7, // dividends
  8, // unrealised gain
  9, // realised gain
  12, // total gain
])

// Numeric column indices for SubTotal/GrandTotal (skip quantity, IRR, weight, alpha)
const SUBTOTAL_NUMERIC_INDICES = new Set([
  0, // price
  4, // cost
  5, // market value
  7, // dividends
  8, // unrealised gain
  9, // realised gain
  12, // total gain
])

function getVisibility(headerIndex: number): string {
  const header = headers[headerIndex]
  if ("hidden" in header && header.hidden) {
    return "hidden"
  } else if (header.mobile) {
    return ""
  } else if (header.medium) {
    return "hidden sm:table-cell"
  }
  return "hidden xl:table-cell"
}

/**
 * Generates responsive CSS classes for detail row table cells.
 * Encapsulates visibility, padding, alignment, and numeric font styling.
 */
export function getCellClasses(headerIndex: number): string {
  const visibility = getVisibility(headerIndex)
  const padding = "px-0.5 py-1.5 sm:px-1 md:px-2 xl:px-3"
  const fontClass = ROWS_NUMERIC_INDICES.has(headerIndex) ? "tabular-nums" : ""
  return `text-right ${padding} ${visibility} ${fontClass}`
}

/**
 * Generates responsive CSS classes for subtotal/grand-total table cells.
 * Uses header alignment and subtotal-specific numeric columns.
 */
export function getSubTotalCellClasses(headerIndex: number): string {
  const header = headers[headerIndex]
  const visibility = getVisibility(headerIndex)
  const align = header.align === "center" ? "text-center" : "text-right"
  const padding = "px-0.5 py-1.5 sm:px-1 md:px-2 xl:px-3"
  const fontClass = SUBTOTAL_NUMERIC_INDICES.has(headerIndex)
    ? "tabular-nums"
    : ""
  return `${padding} ${align} ${visibility} ${fontClass}`
}
