import React, { ReactElement, useCallback, useState } from "react"
import { Asset, AssetOption } from "types/beancounter"
import { buildNewsAsset } from "@lib/assets/assetUtils"
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
  /** Open the review popup for a held or watched asset. */
  showAsset: (asset: Asset) => void
  /** Close the popup. */
  close: () => void
}

/**
 * Manages Asset Review popup state. The lookup screen opens it from an
 * AssetOption; holding rows and cards open it from a full Asset, built with
 * buildNewsAsset like the watchlist's News popup.
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
  const showAsset = useCallback(
    (asset: Asset) => setTarget(buildNewsAsset(asset)),
    [],
  )
  const popup = target ? (
    <AssetReviewPopup
      key={`${target.ticker}|${target.market || ""}`}
      ticker={target.ticker}
      market={target.market}
      assetName={target.assetName}
      onClose={close}
    />
  ) : null
  return { popup, showReview, showAsset, close }
}
