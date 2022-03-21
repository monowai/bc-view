import { Currency } from "@/core/types/beancounter";
import { useEffect, useState } from "react";
import { BcResult } from "@/core/types/app";
import useApiFetchHelper, { getOptions } from "@/core/api/use-api-fetch-helper";

export function get(currencies: Currency[], value: string): Currency[] | undefined {
  return currencies.filter((currency) => currency.code === value);
}

export const USD = { code: "USD" } as Currency;
