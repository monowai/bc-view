// export type ValueIn = "TRADE" | "BASE" | "PORTFOLIO";

import { ValuationOption } from "./beancounter";

// Enum is pointer to a collection of values in the holding contract
export enum ValueIn {
  TRADE = "TRADE",
  BASE = "BASE",
  PORTFOLIO = "PORTFOLIO",
}

export function valuationOptions(): ValuationOption[] {
  return [
    { value: ValueIn.PORTFOLIO, label: "Portfolio" },
    { value: ValueIn.BASE, label: "Base" },
    { value: ValueIn.TRADE, label: "Trade" },
  ];
}
