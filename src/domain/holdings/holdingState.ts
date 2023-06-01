import { valuationOptions } from "@core/components/valueIn";
import { defaultGroupBy } from "@core/components/groupBy";
import { hookstate, useHookstate } from "@hookstate/core";
import { GroupOption, HoldingDefaults, ValuationOption } from "@core/types/app";

const holdingDefaults: HoldingDefaults = {
  hideEmpty: true,
  valueIn: valuationOptions()[0],
  groupBy: defaultGroupBy,
};
const holdingState: HoldingDefaults = hookstate(holdingDefaults);

// This function wraps the state by an interface,
// i.e. the state link is not accessible directly outside of this module.
// The state for options in HoldingState.ts exposes the state directly.

export function useHoldingState() {
  const state = useHookstate(holdingState);

  return {
    get isHideEmpty(): boolean {
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
