import React from "react"
import { currencySymbolFor, formatCurrencySymbol } from "@lib/formatters"

const HIDDEN_VALUE = "****"

/** The slice of a recharts tooltip payload entry this tooltip reads. */
type PayloadItem = {
  dataKey?: string | number | ((obj: unknown) => unknown)
  value?: unknown
}

export interface WealthPointTooltipProps {
  active?: boolean
  label?: number | string
  payload?: ReadonlyArray<PayloadItem>
  currency?: string
  hideValues: boolean
  /** Plan phase at this age, for the "Age 69 — Go-Go" heading. */
  planName?: string
}

/** Series the reader is hovering, in the order they should read. */
const SERIES_LABELS: Record<string, string> = {
  endingBalance: "Balance",
  p50: "Middle outcome",
  liquidValue: "You can spend this",
  housingValue: "Tied up in property",
  annuitizedValue: "Locked in CPF LIFE",
}
const SERIES_ORDER = Object.keys(SERIES_LABELS)

/**
 * Tooltip for the wealth-over-time chart.
 *
 * Recharts' default row reads "Money you can spend : S$1.10M" — the series
 * name first and a compact figure second, which is the reverse of what the
 * hover is for. The reader put the cursor on a point to learn its value, so
 * the exact amount leads in the largest type and the series name sits under
 * it as a caption. That caption is "Balance": the point is the year-end
 * balance, not a spendable amount — what can be spent is the "made of" lens. The axis stays compact; the hover is where the precision
 * lives.
 *
 * The Monte Carlo bands are drawn as stacked base+width areas so the fill
 * can float, and their raw keys (`p10Base`, `outerWidth`, …) mean nothing to
 * a reader. They are reassembled here into the ranges the legend names.
 */
export default function WealthPointTooltip({
  active,
  label,
  payload,
  currency,
  hideValues,
  planName,
}: WealthPointTooltipProps): React.ReactElement | null {
  if (!active || !payload?.length) return null

  const symbol = currencySymbolFor(currency)
  // Sign before the symbol ("-S$500"), as formatCompact spells it: a
  // drawdown shortfall is a negative endingBalance, and "S$-500" reads as a
  // typo rather than a debt.
  const exact = (value: number): string => {
    if (hideValues) return HIDDEN_VALUE
    const sign = value < 0 ? "-" : ""
    return `${sign}${formatCurrencySymbol(Math.round(Math.abs(value)), symbol)}`
  }

  const byKey = new Map<string, number>()
  for (const p of payload) {
    const value = Number(p.value)
    if (p.dataKey != null && Number.isFinite(value)) {
      byKey.set(String(p.dataKey), value)
    }
  }

  const rows = SERIES_ORDER.filter((key) => byKey.has(key)).map((key) => ({
    key,
    label: SERIES_LABELS[key],
    value: exact(byKey.get(key) ?? 0),
  }))

  const range = (baseKey: string, widthKey: string): string | null => {
    const base = byKey.get(baseKey)
    const width = byKey.get(widthKey)
    if (base == null || width == null) return null
    return hideValues ? HIDDEN_VALUE : `${exact(base)} – ${exact(base + width)}`
  }
  const ranges = [
    { label: "Most likely range", value: range("p25Base", "innerWidth") },
    { label: "Range of outcomes", value: range("p10Base", "outerWidth") },
  ].filter((r): r is { label: string; value: string } => r.value != null)

  if (rows.length === 0 && ranges.length === 0) return null

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-900 shadow-md">
      <div className="text-xs font-medium text-gray-500">
        {planName ? `Age ${label} — ${planName}` : `Age ${label}`}
      </div>
      {rows.map((row, idx) => (
        <div key={row.key} className={idx === 0 ? "mt-1" : "mt-1.5"}>
          <div
            className={
              idx === 0
                ? "text-base font-semibold tabular-nums"
                : "text-sm font-medium tabular-nums"
            }
          >
            {row.value}
          </div>
          <div className="text-xs text-gray-500">{row.label}</div>
        </div>
      ))}
      {ranges.map((r) => (
        <div key={r.label} className="mt-1.5">
          <div className="text-xs tabular-nums text-gray-700">{r.value}</div>
          <div className="text-xs text-gray-500">{r.label}</div>
        </div>
      ))}
    </div>
  )
}
