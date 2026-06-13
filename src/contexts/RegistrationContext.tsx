import React, { createContext, useContext, useEffect, useState } from "react"
import { useUser } from "@auth0/nextjs-auth0/client"

const ONBOARDING_COMPLETE_KEY = "bc_onboarding_complete"
const REGISTERED_KEY_PREFIX = "bc_registered:"
const DEFAULT_TTL_DAYS = 30

// Externally configured at build time via NEXT_PUBLIC_REGISTRATION_TTL_DAYS.
// Number(undefined) is NaN; NaN || fallback collapses to the default. Treat
// non-positive values as the default so a stray 0 doesn't force every load
// to hit /api/register again.
function resolveTtlMs(): number {
  const raw = Number(process.env.NEXT_PUBLIC_REGISTRATION_TTL_DAYS)
  const days = raw > 0 ? raw : DEFAULT_TTL_DAYS
  return days * 24 * 60 * 60 * 1000
}

const REGISTRATION_TTL_MS = resolveTtlMs()

interface CachedRegistration {
  since?: string
  checkedAt: number
}

function registeredKey(sub: string): string {
  return `${REGISTERED_KEY_PREFIX}${sub}`
}

function readCachedRegistration(sub: string): CachedRegistration | null {
  try {
    const raw = localStorage.getItem(registeredKey(sub))
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedRegistration
    if (typeof parsed.checkedAt !== "number") return null
    if (Date.now() - parsed.checkedAt > REGISTRATION_TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}

function writeCachedRegistration(sub: string, since?: string): void {
  try {
    localStorage.setItem(
      registeredKey(sub),
      JSON.stringify({
        since,
        checkedAt: Date.now(),
      } satisfies CachedRegistration),
    )
  } catch {
    // localStorage may be unavailable (private mode, quota); just skip caching.
  }
}

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

    if (!user?.sub) {
      // Checking flag for the backend registration flow (external system);
      // cleared here when there is no user to register.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsChecking(false)
      return
    }

    const sub = user.sub
    const onboardingComplete =
      localStorage.getItem(ONBOARDING_COMPLETE_KEY) === "true"

    // Fast path: a recent cached registration (per user.sub) skips /api/register.
    // bc-data's SystemUser is created on first /register call and never removed,
    // so re-checking on every pageload is wasted work — ~90ms + bc-data lookup
    // per load with no behaviour change. The TTL exists so users whose backend
    // record is rotated externally (rare) eventually re-validate.
    const cached = readCachedRegistration(sub)
    if (cached) {
      setIsRegistered(true)
      setIsNewlyRegistered(false)
      setIsOnboardingComplete(onboardingComplete)
      setIsChecking(false)
      return
    }

    const ensureRegistered = async (): Promise<void> => {
      setIsChecking(true)
      setError(null)
      setIsOnboardingComplete(onboardingComplete)

      try {
        // Single idempotent call - returns existing user or creates new one
        const response = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })

        if (response.ok) {
          const data = await response.json()
          const since = data.data?.since as string | undefined
          writeCachedRegistration(sub, since)
          setIsRegistered(true)

          // Check if this is a newly created user
          const isNew = isNewUser(since)
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
