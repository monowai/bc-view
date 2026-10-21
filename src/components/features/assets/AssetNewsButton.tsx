import React, { ReactElement } from "react"
import { Asset } from "types/beancounter"
import { usePermissions } from "@hooks/usePermissions"

interface AssetNewsButtonProps {
  asset: Asset
  onShow: () => void
  /** Override icon size (default `text-xs`). */
  iconClassName?: string
  /** Font Awesome icon (default `fa-newspaper`); holdings shows the AI sparkle. */
  icon?: string
}

/**
 * News icon button next to a holding's title. Hidden when the server says the
 * asset has no news to fetch (`asset.hasNews`). Click stops propagation so it doesn't
 * trigger the surrounding row/card click handler.
 */
const AssetNewsButton: React.FC<AssetNewsButtonProps> = ({
  asset,
  onShow,
  iconClassName = "text-xs",
  icon = "fa-newspaper",
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
      className="text-gray-400 hover:text-blue-600 transition-colors"
      title={`News for ${ticker}`}
      aria-label={`News ${ticker}`}
    >
      <i aria-hidden="true" className={`fas ${icon} ${iconClassName}`}></i>
    </button>
  )
}

export default AssetNewsButton
