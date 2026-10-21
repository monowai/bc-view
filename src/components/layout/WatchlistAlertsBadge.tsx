import React from "react"
import Link from "next/link"
import { useRegistration } from "@contexts/RegistrationContext"
import { useWatchlistAlerts } from "@hooks/useWatchlistAlerts"
import { WATCHLIST_ALERTS_ANCHOR } from "@components/features/watchlists/WatchlistAlertsPanel"

/**
 * Header notification badge counting watchlist target alerts awaiting
 * dismissal. Hidden at zero. Clicking opens the alerts on the watchlist page.
 */
export default function WatchlistAlertsBadge(): React.ReactElement | null {
  const { isRegistered, isChecking } = useRegistration()
  // Alerts are raised at market close, so a slow poll is plenty.
  const { alerts, error } = useWatchlistAlerts(isRegistered, {
    refreshInterval: 300_000,
  })

  if (isChecking || error || !alerts) return null
  const count = alerts.length
  if (count === 0) return null

  const label = `${count} watchlist target alert${count === 1 ? "" : "s"}`
  return (
    <Link
      href={`/watchlist#${WATCHLIST_ALERTS_ANCHOR}`}
      aria-label={label}
      title={label}
      className="relative p-2 text-gray-300 hover:text-white transition-colors"
    >
      <i aria-hidden="true" className="fas fa-bullseye text-lg"></i>
      <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
        {count > 99 ? "99+" : count}
      </span>
    </Link>
  )
}
