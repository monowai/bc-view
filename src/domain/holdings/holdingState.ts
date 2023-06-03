import { valuationOptions } from "@core/components/valueIn";
import { defaultGroupBy } from "@core/components/groupBy";
import { hookstate, useHookstate } from "@hookstate/core";
import { devtools } from "@hookstate/devtools";
import { GroupOption, HoldingDefaults, ValuationOption } from "@core/types/app";

const holdingDefaults = hookstate(
  {
    hideEmpty: true,
    valueIn: valuationOptions()[0],
    groupBy: defaultGroupBy,
  },
  devtools({ key: "holdings" })
);

// This function wraps the state by an interface,
// i.e. the state link is not accessible directly outside of this module.
// The state for options in HoldingState.ts exposes the state directly.

export function useHoldingState(): HoldingDefaults {
  const state = useHookstate(holdingDefaults);

  return {
    get hideEmpty(): boolean {
      return state.hideEmpty.get();
    },
    toggleHideEmpty(): void {
      state.hideEmpty.set((hide) => !hide);
    },
    get valueIn(): ValuationOption {
      return state.valueIn.get();
    },
    setValueIn(value: ValuationOption): void {
      state.valueIn.set(value);
    },
    get groupBy(): GroupOption {
      return state.groupBy.get();
    },
    setGroupBy(value: GroupOption): void {
      state.groupBy.set(value);
    },
  };
}
