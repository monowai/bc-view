import { hookstate, useHookstate } from "@hookstate/core"
import { devtools } from "@hookstate/devtools"
import {
  DisplayCurrencyOption,
  GroupOption,
  HoldingDefaults,
  ValuationOption,
} from "types/app"
import { useValuationOptions } from "@components/ui/ValueIn"
import { useGroupOptions } from "@components/features/holdings/GroupByOptions"
import { ViewMode } from "@components/features/holdings/ViewToggle"
import { useEffect } from "react"
import { BC_STORAGE_PREFIX } from "../storage/sessionState"

const defaultDisplayCurrency: DisplayCurrencyOption = { mode: "PORTFOLIO" }

const STORAGE_KEY = `${BC_STORAGE_PREFIX}wealth`

// Load initial state from sessionStorage if available
function loadPersistedState(): Record<string, unknown> | null {
  if (typeof window === "undefined") {
    return null
  }
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch {
    // Ignore parse errors
  }
  return null
}

const persistedState = loadPersistedState()

const holdingDefaults = hookstate(
  {
    hideEmpty: persistedState?.hideEmpty ?? true,
    asAt: persistedState?.asAt ?? "today",
    hasInitialized: persistedState?.hasInitialized ?? false,
    viewMode: (persistedState?.viewMode ?? "summary") as ViewMode,
    valueIn: persistedState?.valueIn ?? null,
    groupBy: persistedState?.groupBy ?? null,
    displayCurrency: persistedState?.displayCurrency ?? null,
  } as HoldingDefaults & { hasInitialized: boolean; viewMode: ViewMode },
  devtools({ key: "holdings" }),
)

// Persist state changes to sessionStorage
// Cross-tab sync is handled by storage events (fired automatically by the browser)
function persistState(state: Record<string, unknown>): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore storage errors
  }
}

// This function wraps the state by an interface,
// i.e. the state link is not accessible directly outside of this module.
// The state for options in HoldingState.ts exposes the state directly.

export function useHoldingState(): HoldingDefaults {
  const state = useHookstate(holdingDefaults)
  const { valuationDefault } = useValuationOptions()
  const { groupDefault } = useGroupOptions()

  // Subscribe to storage changes from other tabs
  useEffect(() => {
    if (typeof window === "undefined") return () => {}

    const handleStorageEvent = (event: StorageEvent): void => {
      if (event.key === STORAGE_KEY && event.newValue) {
        try {
          const newState = JSON.parse(event.newValue)
          if (newState.hideEmpty !== undefined)
            state.hideEmpty.set(newState.hideEmpty as boolean)
          if (newState.asAt !== undefined)
            state.asAt.set(newState.asAt as string)
          if (newState.hasInitialized !== undefined)
            state.hasInitialized.set(newState.hasInitialized as boolean)
          if (newState.viewMode !== undefined)
            state.viewMode.set(newState.viewMode as ViewMode)
          if (newState.valueIn !== undefined && newState.valueIn !== null)
            state.valueIn.set(newState.valueIn as ValuationOption)
          if (newState.groupBy !== undefined && newState.groupBy !== null)
            state.groupBy.set(newState.groupBy as GroupOption)
          if (
            newState.displayCurrency !== undefined &&
            newState.displayCurrency !== null
          )
            state.displayCurrency.set(
              newState.displayCurrency as DisplayCurrencyOption,
            )
        } catch {
          // Ignore parse errors
        }
      }
    }

    window.addEventListener("storage", handleStorageEvent)

    return () => {
      window.removeEventListener("storage", handleStorageEvent)
    }
  }, [state])

  // Helper to persist current state to sessionStorage
  const saveState = (): void => {
    persistState({
      hideEmpty: state.hideEmpty.get(),
      asAt: state.asAt.get(),
      hasInitialized: state.hasInitialized.get(),
      viewMode: state.viewMode.get(),
      valueIn: state.valueIn.get(),
      groupBy: state.groupBy.get(),
      displayCurrency: state.displayCurrency.get(),
    })
  }

  return {
    /**
     * Returns true if Cost/Gains values are approximate due to FX conversion.
     * This happens when a custom Display Currency is selected.
     */
    get isCostApproximate(): boolean {
      // Cost is only approximate when displaying in a custom currency
      return state.displayCurrency.get()?.mode === "CUSTOM"
    },
    get hideEmpty(): boolean {
      return state.hideEmpty.get()
    },
    toggleHideEmpty(): void {
      state.hideEmpty.set((hide) => !hide)
      saveState()
    },
    get valueIn(): ValuationOption {
      return state.valueIn.get() || valuationDefault
    },
    setValueIn(value: ValuationOption): void {
      state.valueIn.set(value)
      // Reset display currency to None (match Value In) when Value In changes
      state.displayCurrency.set({
        mode: value.value as "PORTFOLIO" | "BASE" | "TRADE",
      })
      saveState()
    },
    get groupBy(): GroupOption {
      return state.groupBy.get() || groupDefault
    },
    setGroupBy(value: GroupOption): void {
      state.groupBy.set(value)
      saveState()
    },
    setAsAt(value: string) {
      state.asAt.set(value)
      saveState()
    },
    get asAt(): string {
      return state.asAt.get() || "today"
    },
    get displayCurrency(): DisplayCurrencyOption {
      return state.displayCurrency.get() || defaultDisplayCurrency
    },
    setDisplayCurrency(value: DisplayCurrencyOption): void {
      state.displayCurrency.set(value)
      saveState()
    },
    get hasInitialized(): boolean {
      return state.hasInitialized.get() || false
    },
    setHasInitialized(value: boolean): void {
      state.hasInitialized.set(value)
      saveState()
    },
    get viewMode(): ViewMode {
      return state.viewMode.get() || "summary"
    },
    setViewMode(value: ViewMode): void {
      state.viewMode.set(value)
      saveState()
    },
  }
}
