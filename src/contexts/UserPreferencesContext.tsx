import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react"
import { useUser } from "@auth0/nextjs-auth0/client"
import {
  GroupByApiValue,
  HoldingsView,
  UserPreferences,
} from "types/beancounter"
import {
  apiValueToPropertyPath,
  GROUP_BY_API_VALUES,
  GROUP_BY_OPTIONS,
  GroupByOption,
  VALUE_IN_OPTIONS,
  ValueInOption,
} from "types/constants"
import { useRegistration } from "./RegistrationContext"

interface UserPreferencesContextValue {
  preferences: UserPreferences | null
  isLoading: boolean
  refetch: () => Promise<void>
}

const defaultPreferences: UserPreferences = {
  id: "",
  defaultHoldingsView: "CARDS",
  defaultValueIn: VALUE_IN_OPTIONS.PORTFOLIO,
  defaultGroupBy: GROUP_BY_API_VALUES.ASSET_CLASS,
  baseCurrencyCode: "USD",
  reportingCurrencyCode: "USD",
  showWeightedIrr: true,
}

const UserPreferencesContext = createContext<UserPreferencesContextValue>({
  preferences: null,
  isLoading: true,
  refetch: async () => {},
})

export function UserPreferencesProvider({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement {
  const { user, isLoading: userLoading } = useUser()
  const { isRegistered, isChecking: registrationChecking } = useRegistration()
  const [preferences, setPreferences] = useState<UserPreferences | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchPreferences = useCallback(async (): Promise<void> => {
    if (!user || !isRegistered) {
      setPreferences(defaultPreferences)
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch("/api/me")
      if (response.ok) {
        const data = await response.json()
        if (data.preferences) {
          setPreferences(data.preferences)
        } else {
          // User exists but has no preferences yet - use defaults
          setPreferences(defaultPreferences)
        }
      } else {
        // User not registered yet - use defaults
        setPreferences(defaultPreferences)
      }
    } catch (error) {
      console.error("Failed to fetch user preferences:", error)
      setPreferences(defaultPreferences)
    } finally {
      setIsLoading(false)
    }
  }, [user, isRegistered])

  useEffect(() => {
    // Wait for both user loading and registration to complete
    if (!userLoading && !registrationChecking) {
      fetchPreferences()
    }
  }, [userLoading, registrationChecking, fetchPreferences])

  return (
    <UserPreferencesContext.Provider
      value={{ preferences, isLoading, refetch: fetchPreferences }}
    >
      {children}
    </UserPreferencesContext.Provider>
  )
}

export function useUserPreferences(): UserPreferencesContextValue {
  return useContext(UserPreferencesContext)
}

/**
 * Convert backend HoldingsView enum to frontend ViewMode
 */
export function toViewMode(
  holdingsView: HoldingsView | undefined,
): "summary" | "table" | "cards" | "heatmap" {
  switch (holdingsView) {
    case "TABLE":
      return "table"
    case "CARDS":
      return "cards"
    case "HEATMAP":
      return "heatmap"
    case "ALLOCATION":
      // Allocation view consolidated into Summary
      return "summary"
    case "SUMMARY":
    default:
      return "summary"
  }
}

/**
 * Convert backend ValueInOption to frontend ValueIn string
 */
export function toValueIn(
  defaultValueIn: ValueInOption | undefined,
): ValueInOption {
  switch (defaultValueIn) {
    case VALUE_IN_OPTIONS.BASE:
      return VALUE_IN_OPTIONS.BASE
    case VALUE_IN_OPTIONS.TRADE:
      return VALUE_IN_OPTIONS.TRADE
    case VALUE_IN_OPTIONS.PORTFOLIO:
    default:
      return VALUE_IN_OPTIONS.PORTFOLIO
  }
}

/**
 * Convert backend GroupBy API value (enum name) to frontend property path
 */
export function toGroupBy(
  defaultGroupBy: GroupByApiValue | undefined,
): GroupByOption {
  if (!defaultGroupBy) {
    return GROUP_BY_OPTIONS.ASSET_CLASS
  }
  return apiValueToPropertyPath(defaultGroupBy)
}
