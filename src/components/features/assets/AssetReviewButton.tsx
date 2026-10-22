import React, { ReactElement } from "react"
import { Asset } from "types/beancounter"
import { usePermissions } from "@hooks/usePermissions"

interface AssetReviewButtonProps {
  asset: Asset
  onShow: () => void
  /** Override icon size (default `text-xs`). */
  iconClassName?: string
}

/**
 * AI review sparkle beside an asset's label. Same gate as AssetNewsButton:
 * AI or preview access, and an asset the server says has news
 * (`asset.hasNews`). Click stops propagation so it doesn't trigger the
 * surrounding row or link.
 */
const AssetReviewButton: React.FC<AssetReviewButtonProps> = ({
  asset,
  onShow,
  iconClassName = "text-xs",
}): ReactElement | null => {
  const { ai: canRunAi, preview: canPreview } = usePermissions()
  if (!canRunAi && !canPreview) return null
  if (!asset.hasNews) return null
  const ticker = asset.displayCode
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onShow()
      }}
      className="text-gray-400 hover:text-purple-600 transition-colors"
      title={`AI review of ${ticker}`}
      aria-label={`AI review ${ticker}`}
    >
      <i
        aria-hidden="true"
        className={`fas fa-wand-magic-sparkles ${iconClassName}`}
      ></i>
    </button>
  )
}

export default AssetReviewButton
