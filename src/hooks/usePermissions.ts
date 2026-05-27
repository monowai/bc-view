import { useEffect, useState } from "react"
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

/**
 * Reports the Beancounter permissions held by the current user.
 *  - `ai`      — can run any AI agent review.
 *  - `preview` — can run the Asset AI Review preview surfaces only.
 *  - `admin`   — administrative endpoints.
 *
 * Use `ai || preview` to gate the Asset Review and per-holding News popups;
 * use `ai` alone for full-tier surfaces (portfolio overview, chat, etc.).
 */
export function usePermissions(): PermissionsResult {
  const { user, isLoading: userLoading } = useUser()
  const userSub = user?.sub
  const [perms, setPerms] = useState<Permissions>(EMPTY)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (userLoading) return
    if (!userSub) {
      setPerms(EMPTY)
      setIsLoading(false)
      return
    }

    async function fetchPermissions(): Promise<void> {
      try {
        const response = await fetch("/api/auth/permissions")
        if (response.ok) {
          const data = (await response.json()) as Permissions
          setPerms({
            ai: !!data.ai,
            preview: !!data.preview,
            admin: !!data.admin,
          })
        } else if (response.status !== 401) {
          // 401 just means the session expired; useUser will pick that up.
          console.error(
            "Failed to fetch permissions:",
            response.status,
            response.statusText,
          )
          setPerms(EMPTY)
        } else {
          setPerms(EMPTY)
        }
      } catch (error) {
        console.error("Failed to fetch permissions:", error)
        setPerms(EMPTY)
      } finally {
        setIsLoading(false)
      }
    }

    fetchPermissions()
  }, [userSub, userLoading])

  return { ...perms, isLoading: userLoading || isLoading }
}
