import { useState, useEffect } from "react"
import { useUser } from "@auth0/nextjs-auth0/client"

interface AdminCheckResult {
  isAdmin: boolean
  isLoading: boolean
}

/**
 * Hook to check if the current user has admin privileges.
 * Checks for beancounter:admin scope in the access token.
 */
export function useIsAdmin(): AdminCheckResult {
  const { user, isLoading: userLoading } = useUser()
  const userSub = user?.sub
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (userLoading) return
    if (!userSub) {
      setIsAdmin(false)
      setIsLoading(false)
      return
    }

    async function checkAdmin(): Promise<void> {
      try {
        const response = await fetch("/api/auth/admin-check")
        if (response.ok) {
          const data = await response.json()
          setIsAdmin(data.isAdmin)
        } else if (response.status !== 401) {
          console.error(
            "Failed to check admin status:",
            response.status,
            response.statusText,
          )
          setIsAdmin(false)
        } else {
          setIsAdmin(false)
        }
      } catch (error) {
        console.error("Failed to check admin status:", error)
        setIsAdmin(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkAdmin()
  }, [userSub, userLoading])

  return { isAdmin, isLoading: userLoading || isLoading }
}
