import useSWR from "swr"
import { useUser } from "@auth0/nextjs-auth0/client"

export interface Permissions {
  ai: boolean
  preview: boolean
  admin: boolean
}

interface PermissionsResult extends Permissions {
  /**
   * May use the AI agent surfaces (chat, analyses, reviews, news): `ai` or
   * `preview`. svc-agent meters preview-only users with a weekly quota, so
   * the UI gates on this one flag and leaves the allowance to the server.
   */
  canUseAi: boolean
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
 *  - `ai`      — unlimited use of the AI agent.
 *  - `preview` — the default role: every AI agent surface, metered by
 *                svc-agent's weekly quota (see `useAgentQuota`).
 *  - `canUseAi` — derived `ai || preview`; gate AI features on this.
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
  const permissions = data ?? EMPTY
  return {
    ...permissions,
    canUseAi: permissions.ai || permissions.preview,
    isLoading: userLoading || (user?.sub ? isLoading : false),
  }
}
