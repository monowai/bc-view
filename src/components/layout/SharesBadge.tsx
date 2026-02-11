import React from "react"
import useSwr from "swr"
import Link from "next/link"
import { fetcher } from "@utils/api/fetchHelper"
import { useRegistration } from "@contexts/RegistrationContext"
import { PendingSharesResponse } from "types/beancounter"

/**
 * Header notification badge showing the count of pending share actions
 * (invites + requests) that need user review. Clicking navigates to
 * the managed tab on the portfolios page.
 */
export default function SharesBadge(): React.ReactElement | null {
  const { isRegistered, isChecking } = useRegistration()

  const { data, error } = useSwr<PendingSharesResponse>(
    isRegistered ? "/api/shares/pending" : null,
    fetcher,
    {
      refreshInterval: 300000, // Refresh every 5 minutes
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    },
  )

  if (isChecking || error || !data) {
    return null
  }

  const count = data.invites.length + data.requests.length
  if (count === 0) {
    return null
  }

  return (
    <Link
      href="/portfolios?tab=managed"
      className="relative p-2 text-gray-300 hover:text-white transition-colors"
      title={`${count} pending share action${count === 1 ? "" : "s"}`}
    >
      <i className="fas fa-handshake text-lg"></i>
      <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
        {count > 99 ? "99+" : count}
      </span>
    </Link>
  )
}
