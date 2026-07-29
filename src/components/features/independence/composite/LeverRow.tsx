import React, { ReactNode } from "react"

/**
 * One phase-boundary lever: a labelled decision on the left, its control on
 * the right. Residence and benefits-start both answer the same shape of
 * question ("which phase does this start in?"), so they share one row
 * vocabulary and one control width instead of each inventing their own.
 */
export default function LeverRow({
  label,
  hint,
  control,
}: {
  label: ReactNode
  hint?: ReactNode
  control: ReactNode
}): React.ReactElement {
  return (
    <div className="grid gap-2 py-3 sm:grid-cols-[1fr_16rem] sm:items-center sm:gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
      </div>
      {control}
    </div>
  )
}

/** Shared select styling so every lever control reads as the same affordance. */
export const LEVER_SELECT_CLASS =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-independence-500 focus:outline-none focus:ring-1 focus:ring-independence-500 disabled:opacity-50"
