import { hookstate, useHookstate } from "@hookstate/core";
import { devtools } from "@hookstate/devtools";
import { GroupOption, HoldingDefaults, ValuationOption } from "@core/types/app";
import { GroupBy, ValueIn } from "@core/types/constants";
import { useValuationOptions } from "@core/components/valueIn";
import { useGroupOptions } from "@core/components/groupBy";

const holdingDefaults = hookstate(
  {
    hideEmpty: true,
    valueIn: {
      value: ValueIn.PORTFOLIO,
      label: "",
    },
    groupBy: {
      value: GroupBy.ASSET_CLASS,
      label: "",
    },
  },
  devtools({ key: "holdings" })
);

// This function wraps the state by an interface,
// i.e. the state link is not accessible directly outside of this module.
// The state for options in HoldingState.ts exposes the state directly.

export function useHoldingState(): HoldingDefaults {
  const state = useHookstate(holdingDefaults);
  const { valuationDefault } = useValuationOptions();
  const { groupDefault } = useGroupOptions();

  // Can't use t in Global State
  // Not sure if this is the best way to centralise and establish
  // default, but it works well.
  if (state.valueIn.get().label === "") {
    state.valueIn.set(valuationDefault);
  }

  if (state.groupBy.get().label === "") {
    state.groupBy.set(groupDefault);
  }

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
