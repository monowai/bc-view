import React, { ReactElement, useCallback, useState } from "react"
import { AssetOption } from "types/beancounter"
import AssetReviewPopup from "./AssetReviewPopup"

interface ReviewTarget {
  ticker: string
  market?: string
  assetName?: string
}

export interface UseAssetReviewReturn {
  /** Render this where you want the popup to appear; null when not active. */
  popup: ReactElement | null
  /** Open the review popup for a selected lookup result. */
  showReview: (option: AssetOption) => void
  /** Close the popup. */
  close: () => void
}

/**
 * Manages Asset Review popup state for the assets/lookup screen. Mirrors
 * useNewsAsset on the holdings side, but takes an AssetOption (the shape
 * the lookup screen carries) rather than a full Asset.
 */
export function useAssetReview(): UseAssetReviewReturn {
  const [target, setTarget] = useState<ReviewTarget | null>(null)
  const close = useCallback(() => setTarget(null), [])
  const showReview = useCallback((option: AssetOption) => {
    setTarget({
      ticker: option.symbol,
      market: option.market,
      assetName: option.name || option.label,
    })
  }, [])
  const popup = target ? (
    <AssetReviewPopup
      ticker={target.ticker}
      market={target.market}
      assetName={target.assetName}
      onClose={close}
    />
  ) : null
  return { popup, showReview, close }
}
