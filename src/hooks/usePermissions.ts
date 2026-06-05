import useSWR from "swr"
import { useUser } from "@auth0/nextjs-auth0/client"

export interface Permissions {
  ai: boolean
  preview: boolean
  admin: boolean
}

interface PermissionsResult extends Permissions {
  isLoading: boolean
}

const EMPTY: Permissions = { ai: false, preview: false, admin: false }
const PERMISSIONS_KEY = "/api/auth/permissions"

async function fetchPermissions(url: string): Promise<Permissions> {
  const response = await fetch(url)
  if (response.ok) {
    const data = (await response.json()) as Permissions
    return {
      ai: !!data.ai,
      preview: !!data.preview,
      admin: !!data.admin,
    }
  }
  // 401 is expected when the session is expiring; useUser reacts to it.
  if (response.status !== 401) {
    console.error(
      "Failed to fetch permissions:",
      response.status,
      response.statusText,
    )
  }
  return EMPTY
}

/**
 * Reports the Beancounter permissions held by the current user.
 *  - `ai`      — can run any AI agent review.
 *  - `preview` — can run the Asset AI Review preview surfaces only.
 *  - `admin`   — administrative endpoints (also drives admin gating; the
 *                legacy `useIsAdmin` hook + `/api/auth/admin-check` route
 *                were removed in favour of this single source of truth).
 *
 * SWR-backed: all callers within `dedupingInterval` share a single in-flight
 * request, so the dozen consumers a typical page mount produces collapse to
 * one /api/auth/permissions call.
 */
export function usePermissions(): PermissionsResult {
  const { user, isLoading: userLoading } = useUser()
  const { data, isLoading } = useSWR<Permissions>(
    user?.sub ? PERMISSIONS_KEY : null,
    fetchPermissions,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  )
  return {
    ...(data ?? EMPTY),
    isLoading: userLoading || (user?.sub ? isLoading : false),
  }
}
