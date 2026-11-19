import React, { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/router"
import Alert from "@components/ui/Alert"
import {
  DividendsWaitNotice,
  startBackgroundLoad,
} from "@components/features/portfolios/BackgroundLoadNotice"
import type { Portfolio } from "types/beancounter"

interface DoneStepProps {
  recorded: number
  warnings: string[]
  brokerId: string
  portfolio: Pick<Portfolio, "id" | "code">
  /** Where a load of dividends and splits starts (yyyy-mm-dd). */
  loadFrom: string
  onImportAnother: () => void
}

/**
 * Step 3: what was recorded, then whether to load the portfolio's dividends
 * and splits before going to it.
 */
export default function DoneStep({
  recorded,
  warnings,
  brokerId,
  portfolio,
  loadFrom,
  onImportAnother,
}: DoneStepProps): React.ReactElement {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const holdingsHref = `/holdings/${encodeURIComponent(portfolio.code)}`

  const loadAndView = async (): Promise<void> => {
    setLoading(true)
    setLoadError(null)
    const outcome = await startBackgroundLoad(portfolio.id, loadFrom)
    if (outcome.status === "ERROR") {
      setLoadError(outcome.message)
      setLoading(false)
      return
    }
    void router.push(holdingsHref)
  }

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

      <section
        aria-labelledby="load-events-heading"
        className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3 text-sm text-blue-900"
      >
        <h3 id="load-events-heading" className="text-base font-semibold">
          Load dividends and splits?
        </h3>
        <p>
          {`Recording the income these holdings have paid since ${loadFrom} is how each position's overall return is accounted for, not just its price change.`}
        </p>
        <p>
          <DividendsWaitNotice />{" "}
          {
            "Settling a dividend increases the portfolio's cash balance. If that cash is not held in this portfolio, set the cash balance to 0, or to the cash your broker actually shows."
          }
        </p>
        <p className="text-blue-800">
          {`Only ${portfolio.code} is changed. Other portfolios holding the same assets are left as they are.`}
        </p>
        {loadError && <Alert variant="error">{loadError}</Alert>}
        <div className="flex flex-wrap gap-3 items-center pt-1">
          <button
            type="button"
            onClick={loadAndView}
            disabled={loading}
            className="btn-primary disabled:opacity-50"
          >
            {loading ? "Starting…" : "Load and View Portfolio"}
          </button>
          <button
            type="button"
            onClick={() => void router.push(holdingsHref)}
            disabled={loading}
            className="py-2 px-4 rounded-lg border border-blue-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Skip
          </button>
        </div>
      </section>

      <div className="flex flex-wrap gap-3 items-center">
        <button
          type="button"
          onClick={onImportAnother}
          className="py-2 px-4 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
        >
          Import Another File
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
