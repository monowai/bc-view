import React, { useState } from "react"
import Link from "next/link"
import { WatchlistAlert } from "types/beancounter"
import {
  buildAssetLookupHref,
  getPositionDisplayName,
  priceDecimals,
} from "@lib/assets/assetUtils"
import { formatCurrency, formatDate } from "@lib/formatters"
import { dismissWatchlistAlert } from "@utils/api/client/watchlist"

interface WatchlistAlertsPanelProps {
  alerts: WatchlistAlert[]
  /** Called with the alerts svc-data says remain after a dismiss. */
  onDismissed: (remaining: WatchlistAlert[]) => void
}

/** Target hits awaiting dismissal. Every figure is the backend's; this only formats. */
export default function WatchlistAlertsPanel({
  alerts,
  onDismissed,
}: WatchlistAlertsPanelProps): React.ReactElement | null {
  if (alerts.length === 0) return null
  return (
    <section
      id="alerts"
      aria-label="Target alerts"
      className="mb-5 bg-amber-50 border border-amber-200 rounded-xl p-4"
    >
      <h2 className="text-sm font-semibold text-amber-800 mb-3">
        <i aria-hidden="true" className="fas fa-bullseye mr-2"></i>
        {"Targets Hit"}
      </h2>
      <div className="space-y-2">
        {alerts.map((alert) => (
          <AlertRow key={alert.id} alert={alert} onDismissed={onDismissed} />
        ))}
      </div>
    </section>
  )
}

function AlertRow({
  alert,
  onDismissed,
}: {
  alert: WatchlistAlert
  onDismissed: (remaining: WatchlistAlert[]) => void
}): React.ReactElement {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const code = getPositionDisplayName(alert.asset)
  const dp = priceDecimals(alert.asset)

  const handleDismiss = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      onDismissed(await dismissWatchlistAlert(alert.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dismiss failed")
      setBusy(false)
    }
  }

  return (
    <div
      data-testid={`watchlist-alert-${alert.id}`}
      className="bg-white rounded-lg p-3 shadow-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm text-gray-900">
            <Link
              href={buildAssetLookupHref(alert.asset)}
              className="font-semibold hover:text-blue-600"
            >
              {code}
            </Link>
            <span className="ml-2">
              {alert.direction === "ABOVE" ? "rose to" : "fell to"}{" "}
              <span className="tabular-nums font-medium">
                {formatCurrency(alert.targetPrice, dp)}
              </span>{" "}
              {"target"}
            </span>
          </div>
          {alert.asset.name && alert.asset.name !== code && (
            <div className="text-xs text-gray-500 truncate">
              {alert.asset.name}
            </div>
          )}
          <div className="text-xs text-gray-500">
            {"Closed "}
            <span className="tabular-nums">
              {formatCurrency(alert.close, dp)}
            </span>{" "}
            {alert.currency.code}
            {" on "}
            {formatDate(alert.priceDate)}
          </div>
        </div>
        <button
          type="button"
          aria-label={`Dismiss ${code} alert`}
          onClick={handleDismiss}
          disabled={busy}
          className="bg-gray-300 text-gray-700 text-xs px-3 py-1.5 rounded hover:bg-gray-400 transition-colors disabled:opacity-50"
        >
          {"Dismiss"}
        </button>
      </div>
      {error && (
        <div className="mt-2 text-xs text-red-600" role="alert">
          {error}
        </div>
      )}
    </div>
  )
}
