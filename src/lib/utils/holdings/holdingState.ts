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

const defaultDisplayCurrency: DisplayCurrencyOption = { mode: "PORTFOLIO" }

const holdingDefaults = hookstate(
  {
    hideEmpty: true,
    asAt: "today",
  } as HoldingDefaults,
  devtools({ key: "holdings" }),
)

// This function wraps the state by an interface,
// i.e. the state link is not accessible directly outside of this module.
// The state for options in HoldingState.ts exposes the state directly.

export function useHoldingState(): HoldingDefaults {
  const state = useHookstate(holdingDefaults)
  const { valuationDefault } = useValuationOptions()
  const { groupDefault } = useGroupOptions()

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
    },
    get groupBy(): GroupOption {
      return state.groupBy.get() || groupDefault
    },
    setGroupBy(value: GroupOption): void {
      state.groupBy.set(value)
    },
    setAsAt(value: string) {
      state.asAt.set(value)
    },
    get asAt(): string {
      return state.asAt.get() || "today"
    },
    get displayCurrency(): DisplayCurrencyOption {
      return state.displayCurrency.get() || defaultDisplayCurrency
    },
    setDisplayCurrency(value: DisplayCurrencyOption): void {
      state.displayCurrency.set(value)
    },
  }
}
