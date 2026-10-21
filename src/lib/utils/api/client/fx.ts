/**
 * Browser-side calls to the FX API (`/api/fx/...`, svc-data). Every FX rate
 * fetch goes through `postFxRates`; the hooks that cache or combine rates
 * (useFxRates, useDisplayCurrencyConversion, useFxMatrix) call it.
 *
 * Keys double as SWR cache keys: keep them byte-identical.
 */
import { FxRequest } from "types/beancounter"
import { jsonInit } from "@utils/api/client/request"

export const fxKey = "/api/fx"
export const fxProvidersKey = `${fxKey}/providers`
export const fxHistoryKey = (
  from: string,
  to: string,
  months: number,
): string => `${fxKey}/history?from=${from}&to=${to}&months=${months}`
/** SWR key naming a set of pairs; the fetch itself is a POST. */
export const fxPairsKey = (
  pairs: Array<{ from: string; to: string }>,
): string => `${fxKey}?pairs=${pairs.map((p) => `${p.from}:${p.to}`).join(",")}`

/** POST `/api/fx`: rates for each `from:to` pair. */
export function postFxRates(request: FxRequest): Promise<Response> {
  return fetch(fxKey, jsonInit("POST", request))
}
