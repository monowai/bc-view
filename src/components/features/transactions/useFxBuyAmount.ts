import { useCallback, useEffect, useState } from "react"
import { calculateFxBuyAmount } from "@lib/trns/cashFormHelpers"

interface UseFxBuyAmountOptions {
  sellAmount: number
  fxRate: number | null
  /** Writes the buy amount into the form. Must be stable (useCallback). */
  onBuyAmount: (value: number) => void
  /** False suspends the auto-calculation (e.g. not an FX transaction). */
  enabled?: boolean
}

interface UseFxBuyAmountResult {
  /** True once the user has typed a buy amount of their own. */
  manualBuyAmount: boolean
  /** Use a typed buy amount and stop auto-calculating it. */
  overrideBuyAmount: (value: number) => void
  /** Go back to sell amount x rate (e.g. the sell side changed). */
  resumeAutoBuyAmount: () => void
}

/**
 * Keeps an FX buy amount at sell amount x rate (2dp) until the user types
 * their own. The form owns the value; this owns when it is recomputed.
 */
export function useFxBuyAmount({
  sellAmount,
  fxRate,
  onBuyAmount,
  enabled = true,
}: UseFxBuyAmountOptions): UseFxBuyAmountResult {
  const [manualBuyAmount, setManualBuyAmount] = useState(false)

  // Pushes derived FX output back into the form so other watchers see it;
  // this *is* the intended side-effect.
  useEffect(() => {
    if (enabled && fxRate && sellAmount > 0 && !manualBuyAmount) {
      onBuyAmount(calculateFxBuyAmount(sellAmount, fxRate))
    }
  }, [enabled, fxRate, sellAmount, manualBuyAmount, onBuyAmount])

  const overrideBuyAmount = useCallback(
    (value: number) => {
      setManualBuyAmount(true)
      onBuyAmount(value)
    },
    [onBuyAmount],
  )

  const resumeAutoBuyAmount = useCallback(() => setManualBuyAmount(false), [])

  return { manualBuyAmount, overrideBuyAmount, resumeAutoBuyAmount }
}
