import React, { useState } from "react"
import MathInput from "@components/ui/MathInput"

export interface FxConverterProps {
  from: string
  to: string
  rate: number
  onSwap?: () => void
  compact?: boolean
}

function formatResult(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export default function FxConverter({
  from,
  to,
  rate,
  onSwap,
  compact = false,
}: FxConverterProps): React.ReactElement {
  const [amount, setAmount] = useState<number>(0)

  const result = amount > 0 ? formatResult(amount * rate) : null

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-blue-200 whitespace-nowrap">
          Quick Convert
        </span>
        <MathInput
          value={amount || undefined}
          onChange={setAmount}
          className="w-28 rounded-md bg-white/20 border border-white/30 px-2 py-1 text-sm tabular-nums text-white placeholder-blue-200 focus:bg-white/30 focus:outline-none focus:ring-1 focus:ring-white/50"
          placeholder="Amount"
        />
        {result && (
          <span className="text-sm tabular-nums text-blue-100 whitespace-nowrap">
            = <span className="font-bold text-white">~{result}</span>
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500 tabular-nums">
        1 {from} = {rate.toFixed(4)} {to}
      </p>
      <div className="flex items-end gap-4">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-600">
            {from}
          </label>
          <MathInput
            value={amount || undefined}
            onChange={setAmount}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm tabular-nums focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Enter amount"
          />
        </div>

        {onSwap && (
          <button
            type="button"
            onClick={onSwap}
            aria-label="Swap currencies"
            className="mb-1 rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M13.2 2.24a.75.75 0 0 0-1.4 0l-2.5 6a.75.75 0 0 0 1.38.58L11.5 7h3l.82 1.82a.75.75 0 1 0 1.38-.58l-2.5-6ZM12 5.5l-.5 1h1l-.5-1ZM2.96 9.42a.75.75 0 0 1 1.06-.02l1.72 1.66V5.75a.75.75 0 0 1 1.5 0v5.31l1.72-1.66a.75.75 0 0 1 1.04 1.08l-3 2.89a.75.75 0 0 1-1.04 0l-3-2.89a.75.75 0 0 1-.02-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}

        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-600">
            {to}
          </label>
          <div className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm tabular-nums">
            {result ?? "-"}
          </div>
        </div>
      </div>
    </div>
  )
}
