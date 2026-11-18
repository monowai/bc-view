import React from "react"
import { formatCurrency } from "@utils/formatters"
import type { ScreenshotProposal } from "types/beancounter"

function Fact({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}): React.ReactElement {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className={value ? "text-gray-900" : "text-gray-400"}>
        {value || "Not shown"}
      </dd>
    </div>
  )
}

/** Half a cent: the most each row's printed market value can be rounded by. */
const HALF_CENT = 0.005

/**
 * The read rows' market values added up, when the screenshot shows a total they
 * miss by more than each row's rounding; null otherwise. A digit misread so the
 * row still agrees with itself is caught only here.
 */
export function totalGap(proposal: ScreenshotProposal): number | null {
  const values = proposal.rows
    .map((row) => row.marketValue)
    .filter((value): value is number => value != null)
  if (proposal.totalShown == null || values.length === 0) return null
  const sum = values.reduce((total, value) => total + value, 0)
  const allowed = values.length * HALF_CENT + Number.EPSILON * sum
  return Math.abs(sum - proposal.totalShown) > allowed ? sum : null
}

/** What the screenshot itself says about whose account it is. */
export default function ReadSummary({
  proposal,
}: {
  proposal: ScreenshotProposal
}): React.ReactElement {
  const gap = totalGap(proposal)
  return (
    <section
      aria-label="Read from the image"
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"
    >
      <h3 className="text-sm font-semibold text-gray-900 mb-2">
        Read from the image
      </h3>
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <Fact label="Brokerage" value={proposal.brokerName} />
        <Fact label="Account digits shown" value={proposal.accountNumber} />
        <Fact label="As of" value={proposal.asOf} />
        <Fact
          label="Total shown"
          value={
            proposal.totalShown == null
              ? null
              : formatCurrency(proposal.totalShown)
          }
        />
      </dl>
      {gap != null && proposal.totalShown != null && (
        <p role="status" className="mt-3 text-sm text-amber-700">
          The rows add up to {formatCurrency(gap)}, not the{" "}
          {formatCurrency(proposal.totalShown)} shown. Check each row: one may
          be misread or cut off.
        </p>
      )}
    </section>
  )
}
