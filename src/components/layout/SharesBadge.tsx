import React from "react"
import useSwr from "swr"
import Link from "next/link"
import { fetcher, resourceSharesPendingKey } from "@utils/api/fetchHelper"
import { useRegistration } from "@contexts/RegistrationContext"
import {
  PendingSharesResponse,
  PendingResourceSharesResponse,
} from "types/beancounter"

/**
 * Header notification badge showing the count of pending share actions
 * (portfolio invites/requests + resource share invites/requests)
 * that need user review. Clicking navigates to the managed tab on
 * the portfolios page.
 */
export default function SharesBadge(): React.ReactElement | null {
  const { isRegistered, isChecking } = useRegistration()

  const { data, error } = useSwr<PendingSharesResponse>(
    isRegistered ? "/api/shares/pending" : null,
    fetcher,
    {
      refreshInterval: 300000,
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    },
  )

  const { data: resourceData, error: resourceError } =
    useSwr<PendingResourceSharesResponse>(
      isRegistered ? resourceSharesPendingKey : null,
      fetcher,
      {
        refreshInterval: 300000,
        revalidateOnFocus: false,
        dedupingInterval: 60000,
      },
    )

  if (isChecking || (error && resourceError)) {
    return null
  }

  const portfolioCount = data ? data.invites.length + data.requests.length : 0
  const resourceCount = resourceData
    ? resourceData.invites.length + resourceData.requests.length
    : 0
  const count = portfolioCount + resourceCount
  if (count === 0) {
    return null
  }

  // Pick the most useful landing page based on what's pending. Portfolio shares
  // take priority because the /portfolios managed tab is the established home
  // for them; INDEPENDENCE_PLAN-only invites route to /independence where the
  // PendingResourceSharesPanel can accept them in context.
  const independenceInvitesOnly =
    portfolioCount === 0 &&
    resourceData != null &&
    [...resourceData.invites, ...resourceData.requests].every(
      (s) => s.resourceType === "INDEPENDENCE_PLAN",
    )
  const href = independenceInvitesOnly
    ? "/independence"
    : "/portfolios?tab=managed"

  return (
    <Link
      href={href}
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
