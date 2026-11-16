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

/** What the screenshot itself says about whose account it is. */
export default function ReadSummary({
  proposal,
}: {
  proposal: ScreenshotProposal
}): React.ReactElement {
  return (
    <section
      aria-label="Read from screenshot"
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"
    >
      <h3 className="text-sm font-semibold text-gray-900 mb-2">
        Read from the screenshot
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
    </section>
  )
}
