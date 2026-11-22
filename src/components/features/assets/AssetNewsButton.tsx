import React, { ReactElement } from "react"
import { Asset } from "types/beancounter"
import { usePermissions } from "@hooks/usePermissions"

interface AssetNewsButtonProps {
  asset: Asset
  onShow: () => void
  /** Override icon size (default `text-xs`). */
  iconClassName?: string
}

/**
 * News icon button next to an asset's label. Hidden when the server says the
 * asset has no news to fetch (`asset.hasNews`). Click stops propagation so it doesn't
 * trigger the surrounding row/card click handler.
 */
const AssetNewsButton: React.FC<AssetNewsButtonProps> = ({
  asset,
  onShow,
  iconClassName = "text-xs",
}): ReactElement | null => {
  const { canUseAi } = usePermissions()
  if (!canUseAi) return null
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
      className="-m-1.5 p-1.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 text-gray-500 hover:text-blue-700 transition-colors"
      title={`News for ${ticker}`}
      aria-label={`News ${ticker}`}
    >
      <i className={`fas fa-newspaper ${iconClassName}`}></i>
    </button>
  )
}

export default AssetNewsButton
