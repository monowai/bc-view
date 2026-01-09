import React, { createContext, useContext, useEffect, useState } from "react"
import { useUser } from "@auth0/nextjs-auth0/client"

const ONBOARDING_COMPLETE_KEY = "bc_onboarding_complete"

interface RegistrationContextValue {
  isChecking: boolean
  isRegistered: boolean
  isNewlyRegistered: boolean
  isOnboardingComplete: boolean
  markOnboardingComplete: () => void
  error: string | null
}

const RegistrationContext = createContext<RegistrationContextValue>({
  isChecking: true,
  isRegistered: false,
  isNewlyRegistered: false,
  isOnboardingComplete: false,
  markOnboardingComplete: () => {},
  error: null,
})

export function RegistrationProvider({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement {
  const { user, isLoading } = useUser()
  const [isChecking, setIsChecking] = useState(true)
  const [isRegistered, setIsRegistered] = useState(false)
  const [isNewlyRegistered, setIsNewlyRegistered] = useState(false)
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const markOnboardingComplete = (): void => {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, "true")
    setIsOnboardingComplete(true)
    setIsNewlyRegistered(false)
  }

  useEffect(() => {
    if (isLoading) {
      return
    }

    if (!user) {
      setIsChecking(false)
      return
    }

    const ensureRegistered = async (): Promise<void> => {
      setIsChecking(true)
      setError(null)

      // Check onboarding status from localStorage
      const onboardingComplete =
        localStorage.getItem(ONBOARDING_COMPLETE_KEY) === "true"
      setIsOnboardingComplete(onboardingComplete)

      try {
        // Single idempotent call - returns existing user or creates new one
        const response = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })

        if (response.ok) {
          const data = await response.json()
          setIsRegistered(true)

          // Check if this is a newly created user
          const isNew = isNewUser(data.data?.since)
          if (isNew && !onboardingComplete) {
            localStorage.removeItem(ONBOARDING_COMPLETE_KEY)
            setIsNewlyRegistered(true)
            setIsOnboardingComplete(false)
          } else {
            setIsNewlyRegistered(false)
          }
        } else {
          const errorText = await response.text()
          console.error("Registration failed:", response.status, errorText)
          setError(`Registration failed: ${response.status}`)
          // Still mark as registered=true to allow the app to function
          setIsRegistered(true)
        }
      } catch (err) {
        console.error("Registration error:", err)
        setError("Failed to connect to server")
        // Still mark as registered to avoid infinite loading
        setIsRegistered(true)
      } finally {
        setIsChecking(false)
      }
    }

    ensureRegistered()
  }, [user, isLoading])

  return (
    <RegistrationContext.Provider
      value={{
        isChecking,
        isRegistered,
        isNewlyRegistered,
        isOnboardingComplete,
        markOnboardingComplete,
        error,
      }}
    >
      {children}
    </RegistrationContext.Provider>
  )
}

export function useRegistration(): RegistrationContextValue {
  return useContext(RegistrationContext)
}

// Check if user was created today (new registration)
function isNewUser(sinceDate?: string): boolean {
  if (!sinceDate) return false
  const today = new Date().toISOString().split("T")[0]
  return sinceDate === today
}
