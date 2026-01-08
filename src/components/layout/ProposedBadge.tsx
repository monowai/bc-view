import React from "react"
import useSwr from "swr"
import Link from "next/link"
import { fetcher } from "@utils/api/fetchHelper"
import { useUser } from "@auth0/nextjs-auth0/client"

interface ProposedCountResponse {
  count: number
}

/**
 * Header notification badge showing the count of proposed transactions
 * that need user review. Clicking navigates to the proposed transactions page.
 */
export default function ProposedBadge(): React.ReactElement | null {
  const { user, isLoading: userLoading } = useUser()

  // Only fetch when user is authenticated
  const { data, error } = useSwr<ProposedCountResponse>(
    user ? "/api/trns/proposed/count" : null,
    fetcher,
    {
      refreshInterval: 60000, // Refresh every minute
      revalidateOnFocus: true,
    },
  )

  // Don't show anything while loading or if there's an error
  if (userLoading || error || !data) {
    return null
  }

  // Don't show badge if count is 0
  if (data.count === 0) {
    return null
  }

  return (
    <Link
      href="/trns/proposed"
      className="relative p-2 text-gray-300 hover:text-white transition-colors"
      title={`${data.count} proposed transaction${data.count === 1 ? "" : "s"} to review`}
    >
      <i className="fas fa-bell text-lg"></i>
      <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
        {data.count > 99 ? "99+" : data.count}
      </span>
    </Link>
  )
}
