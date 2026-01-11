import React, {
  createContext,
  ReactElement,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react"
import { useUserPreferences } from "@contexts/UserPreferencesContext"
import { createSessionState } from "@lib/storage/sessionState"

interface PrivacyModeContextValue {
  hideValues: boolean
  toggleHideValues: () => void
}

// Session state for privacy mode - persists across page refreshes, syncs across micro-frontends
const privacyState = createSessionState<boolean | null>("common", null)

// Context for sharing privacy state across components within a React tree
const PrivacyModeContext = createContext<PrivacyModeContextValue>({
  hideValues: false,
  toggleHideValues: () => {},
})

interface PrivacyModeProviderProps {
  children: ReactNode
}

/**
 * Privacy mode provider for hiding sensitive financial data.
 *
 * When enabled, monetary values and quantities are replaced with "****"
 * while public information (asset prices, names) remains visible.
 *
 * State is stored in sessionStorage for:
 * - Persistence across page refreshes within a session
 * - Synchronization across micro-frontends via custom events
 * - Automatic cleanup when browser closes
 */
export function PrivacyModeProvider({
  children,
}: PrivacyModeProviderProps): ReactElement {
  const { preferences } = useUserPreferences()

  // Initialize from session storage, fall back to preferences, default to false
  const [localHideValues, setLocalHideValues] = useState<boolean | null>(() =>
    privacyState.get(),
  )

  // Compute effective value: local override > preferences > false
  const hideValues = localHideValues ?? preferences?.hideValues ?? false

  // Subscribe to changes from other tabs/micro-frontends
  useEffect(() => {
    return privacyState.subscribe((value: boolean | null) => {
      setLocalHideValues(value)
    })
  }, [])

  const toggleHideValues = useCallback(() => {
    setLocalHideValues((prev) => {
      const currentValue = prev ?? preferences?.hideValues ?? false
      const newValue = !currentValue
      // Persist to session storage and notify other listeners
      privacyState.set(newValue)
      return newValue
    })
  }, [preferences?.hideValues])

  return (
    <PrivacyModeContext.Provider value={{ hideValues, toggleHideValues }}>
      {children}
    </PrivacyModeContext.Provider>
  )
}

/**
 * Hook to access privacy mode state.
 * Must be used within a PrivacyModeProvider.
 */
export function usePrivacyMode(): PrivacyModeContextValue {
  return useContext(PrivacyModeContext)
}
