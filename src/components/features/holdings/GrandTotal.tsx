import { HoldingsInCurrency } from "types/beancounter"
import React, { ReactElement } from "react"
import { FormatValue } from "@components/ui/MoneyUtils"
import { useTranslation } from "next-i18next"
import { headers, HEADER_INDICES } from "./Header"
import { GRANDTOTAL_LAYOUT } from "./constants"

// Totals all subtotal values.
export default function GrandTotal({
  holdings,
  valueIn,
}: HoldingsInCurrency): ReactElement {
  const { t, ready } = useTranslation("common")
  if (!ready) return <tbody />
  if (!holdings.viewTotals) return <tbody />

  // GrandTotal data: skips first column (Price), maps to headers[1-12]
  const gainOnDay = holdings.viewTotals.gainOnDay || 0
  const data: {
    value: number | string | null
    colSpan: number
    multiplier?: number
  }[] = [
    { value: gainOnDay, colSpan: 1 }, // Maps to CHANGE% (headers[1]) - shows gainOnDay sum on mobile
    { value: gainOnDay, colSpan: 1 }, // Maps to GAIN_ON_DAY (headers[2]) - hidden
    { value: null, colSpan: 1 }, // Maps to QUANTITY (headers[3]) - no total for quantity
    { value: holdings.viewTotals.costValue, colSpan: 1 }, // Maps to COST (headers[4])
    { value: holdings.viewTotals.marketValue, colSpan: 1 }, // Maps to MARKET_VALUE (headers[5])
    { value: holdings.viewTotals.irr, colSpan: 1, multiplier: 100 }, // Maps to IRR (headers[6]) - swapped with weight
    { value: holdings.viewTotals.dividends, colSpan: 1 }, // Maps to DIVIDENDS (headers[7])
    { value: holdings.viewTotals.unrealisedGain, colSpan: 1 }, // Maps to UNREALISED_GAIN (headers[8])
    { value: holdings.viewTotals.realisedGain, colSpan: 1 }, // Maps to REALISED_GAIN (headers[9])
    { value: holdings.viewTotals.weight, colSpan: 1, multiplier: 100 }, // Maps to WEIGHT (headers[10]) - swapped with irr
    { value: null, colSpan: 1 }, // Maps to ALPHA (headers[11])
    { value: holdings.viewTotals.totalGain, colSpan: 1 }, // Maps to TOTAL_GAIN (headers[12])
  ]

  return (
    <tbody className="grand-totals" key={holdings.portfolio.code + "totals"}>
      <tr>
        <td
          colSpan={GRANDTOTAL_LAYOUT.TOTAL_CELLS}
          className="border-t-2 border-gray-600"
        />
      </tr>
      <tr
        key={valueIn}
        className="holding-footer text-sm bg-gray-100 border-b-2 border-gray-600 hover:!bg-slate-200 transition-colors duration-200"
      >
        <td className="px-1 py-1 md:px-2 xl:px-4 text-xs md:text-sm font-medium text-right">
          <div>{t("holdings.valueTitle", { valueIn })}</div>
        </td>
        {/* Skip Price column - hidden on mobile portrait, visible on landscape (640px+) */}
        <td colSpan={1} className="hidden sm:table-cell" />
        {data.map((item, index) => {
          // Explicit mapping for each data position to ensure correct alignment
          // Data array order matches header order: Change, GainOnDay, Quantity, Cost, MarketValue, Weight, Dividends, etc.
          let headerIndex
          switch (index) {
            case 0:
              headerIndex = HEADER_INDICES.CHANGE
              break // change (gainOnDay sum on mobile)
            case 1:
              headerIndex = HEADER_INDICES.GAIN_ON_DAY
              break // gainOnDay (hidden)
            case 2:
              headerIndex = HEADER_INDICES.QUANTITY
              break // quantity (empty - no total)
            case 3:
              headerIndex = HEADER_INDICES.COST
              break // costValue
            case 4:
              headerIndex = HEADER_INDICES.MARKET_VALUE
              break // marketValue
            case 5:
              headerIndex = HEADER_INDICES.IRR
              break // irr (swapped with weight)
            case 6:
              headerIndex = HEADER_INDICES.DIVIDENDS
              break // dividends
            case 7:
              headerIndex = HEADER_INDICES.UNREALISED_GAIN
              break // unrealisedGain
            case 8:
              headerIndex = HEADER_INDICES.REALISED_GAIN
              break // realisedGain
            case 9:
              headerIndex = HEADER_INDICES.WEIGHT
              break // weight (swapped with irr)
            case 10:
              headerIndex = HEADER_INDICES.ALPHA
              break // alpha (null)
            case 11:
              headerIndex = HEADER_INDICES.TOTAL_GAIN
              break // totalGain
            default:
              headerIndex = index + 1
          }

          const header = headers[headerIndex]

          // All columns follow header rules exactly
          let visibility
          if (header && "hidden" in header && header.hidden) {
            visibility = "hidden" // Hidden on all screens
          } else if (header?.mobile) {
            visibility = "" // Visible on all screens if mobile: true
          } else if (header?.medium) {
            visibility = "hidden sm:table-cell" // Hidden on mobile portrait, visible on landscape (640px+)
          } else {
            visibility = "hidden xl:table-cell"
          }

          // Get alignment from headers array
          const alignment = header?.align || "right"

          // Determine color for gainOnDay, change, IRR, and weight columns
          let colorClass = ""
          if (
            (headerIndex === HEADER_INDICES.GAIN_ON_DAY ||
              headerIndex === HEADER_INDICES.CHANGE ||
              headerIndex === HEADER_INDICES.IRR ||
              headerIndex === HEADER_INDICES.WEIGHT) &&
            typeof item.value === "number"
          ) {
            if (item.value < 0) {
              colorClass = "text-red-500"
            } else if (item.value > 0) {
              colorClass = "text-green-500"
            }
          }

          // Apply same padding logic as Header and Rows
          const padding = "px-0.5 py-1 sm:px-1 md:px-2 xl:px-4" // Minimal padding on portrait for breathing room

          return (
            <td
              key={index}
              colSpan={item.colSpan}
              className={`${padding} text-xs md:text-sm font-medium text-${alignment} ${visibility} ${colorClass}`}
            >
              {item.value !== null && item.value !== "" ? (
                <>
                  <span className="hidden sm:inline">
                    {(headerIndex === HEADER_INDICES.CHANGE ||
                      headerIndex === HEADER_INDICES.IRR) &&
                    typeof item.value === "number"
                      ? item.value < 0
                        ? "▼ "
                        : item.value > 0
                          ? "▲ "
                          : ""
                      : ""}
                  </span>
                  <FormatValue
                    value={
                      (headerIndex === HEADER_INDICES.CHANGE ||
                        headerIndex === HEADER_INDICES.IRR) &&
                      typeof item.value === "number"
                        ? Math.abs(item.value)
                        : item.value
                    }
                    defaultValue=""
                    multiplier={
                      headerIndex === HEADER_INDICES.IRR ||
                      headerIndex === HEADER_INDICES.WEIGHT
                        ? 100
                        : 1
                    }
                    isPublic={
                      headerIndex === HEADER_INDICES.IRR ||
                      headerIndex === HEADER_INDICES.WEIGHT
                    }
                  />
                  {headerIndex === HEADER_INDICES.WEIGHT && "%"}
                  {/* Remove % signs from IRR for cleaner appearance */}
                </>
              ) : typeof item.value === "string" ? (
                item.value
              ) : headerIndex === HEADER_INDICES.GAIN_ON_DAY ? (
                "0"
              ) : (
                ""
              )}
            </td>
          )
        })}
      </tr>
    </tbody>
  )
}
