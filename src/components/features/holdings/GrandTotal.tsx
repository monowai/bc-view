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
  if (!ready) return <div />
  if (!holdings.viewTotals) return <div />

  // GrandTotal data: skips first column (Price), maps to headers[1-12]
  const data: { value: number | string | null; colSpan: number; multiplier?: number }[] = [
    { value: null, colSpan: 1 },                               // Maps to CHANGE% (headers[1])
    { value: holdings.viewTotals.gainOnDay || 0, colSpan: 1 }, // Maps to GAIN_ON_DAY (headers[2])
    { value: holdings.viewTotals.costValue, colSpan: 1 },      // Maps to QUANTITY (headers[3]) - costValue only in quantity column
    { value: null, colSpan: 1 },                              // Maps to COST (headers[4]) - empty since cost column gets the costValue
    { value: holdings.viewTotals.marketValue, colSpan: 1 },    // Maps to MARKET_VALUE (headers[5])
    { value: holdings.viewTotals.dividends, colSpan: 1 },      // Maps to DIVIDENDS (headers[6])
    { value: holdings.viewTotals.unrealisedGain, colSpan: 1 }, // Maps to UNREALISED_GAIN (headers[7])
    { value: holdings.viewTotals.realisedGain, colSpan: 1 },   // Maps to REALISED_GAIN (headers[8])
    { value: holdings.viewTotals.irr, colSpan: 1, multiplier: 100 }, // Maps to IRR (headers[9])
    { value: null, colSpan: 1 },                               // Maps to ALPHA (headers[10])
    { value: holdings.viewTotals.weight, colSpan: 1, multiplier: 100 }, // Maps to WEIGHT (headers[11])
    { value: holdings.viewTotals.totalGain, colSpan: 1 },      // Maps to TOTAL_GAIN (headers[12])
  ]

  return (
    <tbody className="grand-totals" key={holdings.portfolio.code + "totals"}>
      <tr>
        <td colSpan={GRANDTOTAL_LAYOUT.TOTAL_CELLS} className="border-t-2 border-gray-600" />
      </tr>
      <tr
        key={valueIn}
        className="holding-footer text-sm bg-gray-100 border-b-2 border-gray-600 hover:!bg-slate-200 transition-colors duration-200"
      >
        <td className="px-1 py-1 md:px-2 xl:px-4 text-xs md:text-sm font-medium text-right">
          <div>{t("holdings.valueTitle", { valueIn })}</div>
        </td>
        {/* Skip only Price column (colSpan=1) - Change column should be visible */}
        <td colSpan={1} />
        {data.map((item, index) => {
          // Explicit mapping for each data position to ensure correct alignment
          let headerIndex
          switch(index) {
            case 0: headerIndex = HEADER_INDICES.CHANGE; break           // change (null)
            case 1: headerIndex = HEADER_INDICES.GAIN_ON_DAY; break      // gainOnDay
            case 2: headerIndex = HEADER_INDICES.QUANTITY; break         // costValue in quantity column
            case 3: headerIndex = HEADER_INDICES.COST; break             // cost column (empty)
            case 4: headerIndex = HEADER_INDICES.MARKET_VALUE; break     // marketValue
            case 5: headerIndex = HEADER_INDICES.DIVIDENDS; break        // dividends
            case 6: headerIndex = HEADER_INDICES.UNREALISED_GAIN; break  // unrealisedGain
            case 7: headerIndex = HEADER_INDICES.REALISED_GAIN; break    // realisedGain
            case 8: headerIndex = HEADER_INDICES.IRR; break              // irr
            case 9: headerIndex = HEADER_INDICES.ALPHA; break            // alpha (null)
            case 10: headerIndex = HEADER_INDICES.WEIGHT; break          // weight
            case 11: headerIndex = HEADER_INDICES.TOTAL_GAIN; break      // totalGain
            default: headerIndex = index + 1
          }

          const header = headers[headerIndex]

          // All columns follow header rules exactly
          let visibility
          if (header?.mobile) {
            visibility = "" // Visible on all screens if mobile: true
          } else if (header?.medium) {
            visibility = "hidden md:table-cell"
          } else {
            visibility = "hidden xl:table-cell"
          }

          // Get alignment from headers array
          const alignment = header?.align || "right"

          // Determine color for gainOnDay column
          let colorClass = ""
          if (headerIndex === HEADER_INDICES.GAIN_ON_DAY && typeof item.value === "number") {
            if (item.value < 0) {
              colorClass = "text-red-500"
            } else if (item.value > 0) {
              colorClass = "text-green-500"
            }
          }

          return (
            <td
              key={index}
              colSpan={item.colSpan}
              className={`px-1 py-1 md:px-2 xl:px-4 text-xs md:text-sm font-medium text-${alignment} ${visibility} ${colorClass}`}
            >
              {item.value !== null && item.value !== "" ? (
                <>
                  <FormatValue
                    value={item.value}
                    defaultValue=""
                    multiplier={headerIndex === HEADER_INDICES.IRR || headerIndex === HEADER_INDICES.WEIGHT ? 100 : 1}
                  />
                  {headerIndex === HEADER_INDICES.WEIGHT && "%"}
                  {/* Remove % signs from IRR for cleaner appearance */}
                </>
              ) : (
                typeof item.value === "string" ? item.value : (headerIndex === HEADER_INDICES.GAIN_ON_DAY ? "0" : "")
              )}
            </td>
          )
        })}
      </tr>
    </tbody>
  )
}
