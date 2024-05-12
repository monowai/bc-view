import { hookstate, useHookstate } from "@hookstate/core";
import { devtools } from "@hookstate/devtools";
import { TradeDefaults } from "@components/types/app";
import { Market, TrnInput } from "@components/types/beancounter";

const tradeDefaults = hookstate(
  { onMarket: true } as TradeDefaults,
  devtools({ key: "trade" }),
);

// This function wraps the state by an interface,
// i.e. the state link is not accessible directly outside of this module.
// The state for options in HoldingState.ts exposes the state directly.

export function useTradeState(): TradeDefaults {
  const state = useHookstate(tradeDefaults);

  return {
    get trnInput(): TrnInput {
      return state.trnInput.get();
    },
    setTrnInput(trnInput: TrnInput) {
      state.trnInput.set(trnInput);
    },
    get market(): Market {
      return state.market.get();
    },
    setMarket(value: Market): void {
      state.market.set(value);
    },
    get onMarket(): boolean {
      return state.onMarket.get();
    },
    setOffMarket(value: boolean): void {
      state.onMarket.set(value);
    },
  };
}
