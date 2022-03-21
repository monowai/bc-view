// export type ValueIn = "TRADE" | "BASE" | "PORTFOLIO";

import { ValuationOption } from "./beancounter";
import { t } from "i18next";

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

export const __new__ = "new";
