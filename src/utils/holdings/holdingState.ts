import { hookstate, useHookstate } from "@hookstate/core"
import { devtools } from "@hookstate/devtools"
import { GroupOption, HoldingDefaults, ValuationOption } from "types/app"
import { useValuationOptions } from "@components/ValueIn"
import { useGroupOptions } from "@components/holdings/GroupByOptions"

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
  }
}
