import React from "react"
import MathInput from "@components/ui/MathInput"

/**
 * Minimal shape needed to render a sub-account row. `SubAccount` (config) and
 * any `{ code, displayName }` projection both satisfy it.
 */
export interface SubAccountRow {
  code: string
  displayName?: string
}

interface SubAccountBalanceInputsProps {
  subAccounts: SubAccountRow[]
  values: Record<string, number>
  onChange: (code: string, value: number) => void
  currency: string
  total: number
  label?: string
  totalLabel?: string
}

/**
 * Per-sub-account amount entry for composite policies (e.g. CPF OA / SA / MA),
 * with a running total footer. Presentational only — shared by the "set
 * balance" dialog and the CPF transaction editor so both surfaces offer the
 * identical bucket data-entry display.
 */
export default function SubAccountBalanceInputs({
  subAccounts,
  values,
  onChange,
  currency,
  total,
  label = "Sub-Account Balances",
  totalLabel = "Target Balance",
}: SubAccountBalanceInputsProps): React.ReactElement {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {subAccounts.map((sa) => (
        <div key={sa.code} className="flex items-center space-x-3">
          <span className="text-sm text-gray-700 w-24 flex-shrink-0">
            {sa.displayName || sa.code}
          </span>
          <MathInput
            value={values[sa.code] || 0}
            onChange={(value) => onChange(sa.code, value)}
            placeholder="0"
            aria-label={sa.displayName || sa.code}
            className="flex-1 border-gray-300 rounded-md shadow-sm px-3 py-2 border focus:ring-amber-500 focus:border-amber-500"
          />
        </div>
      ))}
      <div className="flex justify-between items-center pt-2 border-t border-gray-200">
        <span className="text-sm font-medium text-gray-700">{totalLabel}</span>
        <span className="text-sm font-medium">
          {currency} {total.toLocaleString()}
        </span>
      </div>
    </div>
  )
}
