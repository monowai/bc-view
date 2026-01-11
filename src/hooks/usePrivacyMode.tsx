import React, {
  useState,
  useCallback,
  createContext,
  useContext,
  ReactNode,
  ReactElement,
} from "react"
import { useUserPreferences } from "@contexts/UserPreferencesContext"

interface PrivacyModeContextValue {
  hideValues: boolean
  toggleHideValues: () => void
}

// Context for sharing privacy state across components
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
 * State is session-local and does not persist to the backend.
 */
export function PrivacyModeProvider({
  children,
}: PrivacyModeProviderProps): ReactElement {
  const { preferences } = useUserPreferences()
  // Local override state - null means use preferences, boolean means override
  const [localHideValues, setLocalHideValues] = useState<boolean | null>(null)

  // Use local override if set, otherwise fall back to preferences, default false
  const hideValues = localHideValues ?? preferences?.hideValues ?? false

  const toggleHideValues = useCallback(() => {
    setLocalHideValues((prev) => {
      const currentValue = prev ?? preferences?.hideValues ?? false
      return !currentValue
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
