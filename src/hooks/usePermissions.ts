import { useEffect, useState } from "react"

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
  const [perms, setPerms] = useState<Permissions>(EMPTY)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
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
        }
      } catch (error) {
        console.error("Failed to fetch permissions:", error)
        setPerms(EMPTY)
      } finally {
        setIsLoading(false)
      }
    }

    fetchPermissions()
  }, [])

  return { ...perms, isLoading }
}
