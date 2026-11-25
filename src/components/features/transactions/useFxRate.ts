import { useEffect, useState } from "react"
import { FxResponse } from "types/beancounter"
import { postFxRates } from "@utils/api/client/fx"

/** The rates body for one pair; throws when the service answers with an error. */
const fetchFxRates = async (from: string, to: string): Promise<FxResponse> => {
  const response = await postFxRates({ pairs: [{ from, to }] })
  if (!response.ok) throw new Error(`FX rates ${response.status}`)
  return response.json()
}

interface FxRateResult {
  /** Units of `buy` for one unit of `sell`; null while unknown. */
  rate: number | null
  loading: boolean
  /** The lookup failed, as distinct from the service having no rate. */
  failed: boolean
}

/**
 * The market rate from `sell` to `buy`. Same or missing currencies have no
 * rate. A result is kept with the pair it was fetched for, so a rate never
 * outlives a change of currency. A failed lookup says so, so the form can ask
 * for the amount instead of quietly showing nothing.
 */
export function useFxRate(sell?: string, buy?: string): FxRateResult {
  const pair = sell && buy && sell !== buy ? { sell, buy } : null
  const key = pair ? `${pair.sell}:${pair.buy}` : null
  const [result, setResult] = useState<{
    key: string
    rate: number | null
    failed: boolean
  } | null>(null)

  useEffect(() => {
    if (!key) return undefined
    const [from, to] = key.split(":")
    let cancelled = false
    fetchFxRates(from, to)
      .then((response) => ({
        rate: response.data?.rates?.[key]?.rate ?? null,
        failed: false,
      }))
      .catch(() => ({ rate: null, failed: true }))
      .then((outcome) => {
        if (!cancelled) setResult({ key, ...outcome })
      })
    return () => {
      cancelled = true
    }
  }, [key])

  const settled = key !== null && result?.key === key
  return {
    rate: settled ? (result?.rate ?? null) : null,
    loading: key !== null && !settled,
    failed: settled && (result?.failed ?? false),
  }
}
