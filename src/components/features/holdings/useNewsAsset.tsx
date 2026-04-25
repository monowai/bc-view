import React, { ReactElement, useState, useCallback } from "react"
import { Asset } from "types/beancounter"
import { buildNewsAsset, NewsAssetRef } from "@lib/assets/assetUtils"
import NewsSentimentPopup from "./NewsSentimentPopup"

export interface UseNewsAssetReturn {
  /** Render this where you want the popup to appear; null when not active. */
  popup: ReactElement | null
  /** Open the popup for an asset. */
  showNews: (asset: Asset) => void
  /** Close the popup. */
  close: () => void
}

/**
 * Manages news-popup state for a holding view (card or row). Centralizes the
 * `useState<NewsAssetRef | null>` + `<NewsSentimentPopup>` render that both
 * `CardView` and `Rows` were duplicating.
 */
export function useNewsAsset(): UseNewsAssetReturn {
  const [newsAsset, setNewsAsset] = useState<NewsAssetRef | null>(null)
  const close = useCallback(() => setNewsAsset(null), [])
  const showNews = useCallback(
    (asset: Asset) => setNewsAsset(buildNewsAsset(asset)),
    [],
  )
  const popup = newsAsset ? (
    <NewsSentimentPopup
      ticker={newsAsset.ticker}
      market={newsAsset.market}
      assetName={newsAsset.assetName}
      onClose={close}
    />
  ) : null
  return { popup, showNews, close }
}
