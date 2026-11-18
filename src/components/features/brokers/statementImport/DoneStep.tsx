import React, { useState } from "react"
import Link from "next/link"
import Alert from "@components/ui/Alert"
import PortfolioCorporateActionsPopup from "@components/features/portfolios/PortfolioCorporateActionsPopup"
import type { Portfolio } from "types/beancounter"

interface DoneStepProps {
  recorded: number
  warnings: string[]
  brokerId: string
  portfolio: Pick<Portfolio, "id" | "code">
  /** The earliest back-dated holding; null when none was back-dated. */
  backdatedTo: string | null
  onImportAnother: () => void
}

/** Step 3: what was recorded and where to go next. */
export default function DoneStep({
  recorded,
  warnings,
  brokerId,
  portfolio,
  backdatedTo,
  onImportAnother,
}: DoneStepProps): React.ReactElement {
  const [checking, setChecking] = useState(false)
  return (
    <div className="max-w-xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Recorded</h2>
      <p className="text-gray-900">
        {`${recorded} ${recorded === 1 ? "transaction" : "transactions"} recorded.`}
      </p>
      {warnings.length > 0 && (
        <Alert variant="warning">
          <ul className="space-y-1">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </Alert>
      )}
      {backdatedTo && (
        <Alert variant="info">
          <p>
            {`These holdings go back to ${backdatedTo}. Dividends and splits since then may not be recorded yet.`}
          </p>
          <button
            type="button"
            onClick={() => setChecking(true)}
            className="mt-2 font-medium underline"
          >
            Check Corporate Actions
          </button>
        </Alert>
      )}
      {checking && (
        <PortfolioCorporateActionsPopup
          portfolio={portfolio}
          modalOpen={checking}
          onClose={() => setChecking(false)}
        />
      )}
      <div className="flex flex-wrap gap-3 items-center">
        <Link
          href={`/holdings/${encodeURIComponent(portfolio.code)}`}
          className="btn-primary"
        >
          View Portfolio
        </Link>
        <button
          type="button"
          onClick={onImportAnother}
          className="py-2 px-4 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
        >
          Import Another Image
        </button>
        <Link
          href={`/brokers/${encodeURIComponent(brokerId)}/holdings`}
          className="text-sm text-gray-600 underline"
        >
          Holdings at this brokerage account
        </Link>
      </div>
    </div>
  )
}
