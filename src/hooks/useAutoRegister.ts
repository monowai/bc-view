import { useUser } from "@auth0/nextjs-auth0/client"
import { useEffect, useState } from "react"

const REGISTRATION_KEY = "bc_registered"

/**
 * Hook that automatically registers authenticated users with the backend.
 * On first login, calls /api/register to create a SystemUser record.
 * Uses localStorage to avoid repeated registration calls.
 */
export function useAutoRegister(): {
  isRegistering: boolean
  isRegistered: boolean
} {
  const { user, isLoading } = useUser()
  const [isRegistering, setIsRegistering] = useState(false)
  const [isRegistered, setIsRegistered] = useState(false)

  useEffect(() => {
    if (isLoading || !user) {
      return
    }

    // Check if already registered (stored in localStorage)
    const registered = localStorage.getItem(REGISTRATION_KEY)
    if (registered === user.sub) {
      setIsRegistered(true)
      return
    }

    // Register the user
    setIsRegistering(true)
    fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
      .then((response) => {
        if (response.ok) {
          // Store registration flag with user's sub to handle multiple accounts
          localStorage.setItem(REGISTRATION_KEY, user.sub as string)
          setIsRegistered(true)
        } else {
          console.error("Registration failed:", response.status)
        }
      })
      .catch((error) => {
        console.error("Registration error:", error)
      })
      .finally(() => {
        setIsRegistering(false)
      })
  }, [user, isLoading])

  return { isRegistering, isRegistered }
}
