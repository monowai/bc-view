import { useEffect, useState } from "react"
import { FxResponse } from "types/beancounter"
import { postFxRates } from "@utils/api/client/fx"

export const fxFetcher = async (
  from: string,
  to: string,
): Promise<FxResponse | null> => {
  if (!from || !to || from === to) return null
  const response = await postFxRates({ pairs: [{ from, to }] })
  if (!response.ok) return null
  return response.json()
}

interface FxRateResult {
  /** Units of `buy` for one unit of `sell`; null while unknown. */
  rate: number | null
  loading: boolean
}

/**
 * The market rate from `sell` to `buy`. Same or missing currencies have no
 * rate. A result is kept with the pair it was fetched for, so a rate never
 * outlives a change of currency.
 */
export function useFxRate(sell?: string, buy?: string): FxRateResult {
  const pair = sell && buy && sell !== buy ? { sell, buy } : null
  const key = pair ? `${pair.sell}:${pair.buy}` : null
  const [result, setResult] = useState<{
    key: string
    rate: number | null
  } | null>(null)

  useEffect(() => {
    if (!key) return undefined
    const [from, to] = key.split(":")
    let cancelled = false
    fxFetcher(from, to)
      .then((response) => response?.data?.rates?.[key]?.rate ?? null)
      .catch(() => null)
      .then((rate) => {
        if (!cancelled) setResult({ key, rate })
      })
    return () => {
      cancelled = true
    }
  }, [key])

  const settled = key !== null && result?.key === key
  return {
    rate: settled ? (result?.rate ?? null) : null,
    loading: key !== null && !settled,
  }
}
