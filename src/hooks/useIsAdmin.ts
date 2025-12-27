import { useState, useEffect } from "react"

interface AdminCheckResult {
  isAdmin: boolean
  isLoading: boolean
}

/**
 * Hook to check if the current user has admin privileges.
 * Checks for beancounter:admin scope in the access token.
 */
export function useIsAdmin(): AdminCheckResult {
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function checkAdmin(): Promise<void> {
      try {
        const response = await fetch("/api/auth/admin-check")
        if (response.ok) {
          const data = await response.json()
          setIsAdmin(data.isAdmin)
        }
      } catch (error) {
        console.error("Failed to check admin status:", error)
        setIsAdmin(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkAdmin()
  }, [])

  return { isAdmin, isLoading }
}
