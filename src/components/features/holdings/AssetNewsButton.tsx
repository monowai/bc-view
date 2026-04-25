import React, { ReactElement } from "react"
import { Asset } from "types/beancounter"
import { isCashRelated, stripOwnerPrefix } from "@lib/assets/assetUtils"

interface AssetNewsButtonProps {
  asset: Asset
  onShow: () => void
  /** Override icon size (default `text-xs`). */
  iconClassName?: string
}

/**
 * News icon button next to a holding's title. Hidden for cash and PRIVATE-market
 * assets (no public news to fetch). Click stops propagation so it doesn't
 * trigger the surrounding row/card click handler.
 */
const AssetNewsButton: React.FC<AssetNewsButtonProps> = ({
  asset,
  onShow,
  iconClassName = "text-xs",
}): ReactElement | null => {
  if (isCashRelated(asset) || asset.market?.code === "PRIVATE") return null
  const ticker = stripOwnerPrefix(asset.code)
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onShow()
      }}
      className="text-gray-400 hover:text-blue-600 transition-colors"
      title={`News for ${ticker}`}
      aria-label={`News ${ticker}`}
    >
      <i className={`fas fa-newspaper ${iconClassName}`}></i>
    </button>
  )
}

export default AssetNewsButton
