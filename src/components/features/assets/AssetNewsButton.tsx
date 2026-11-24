import React, { ReactElement } from "react"
import { Asset } from "types/beancounter"
import { usePermissions } from "@hooks/usePermissions"
import { INLINE_ICON_BUTTON } from "./iconButtonClasses"

interface AssetNewsButtonProps {
  asset: Asset
  onShow: () => void
  /** Override icon size (default `text-xs`). */
  iconClassName?: string
  /** Override the button's box (default: a tight inline hit area). */
  buttonClassName?: string
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
  buttonClassName = INLINE_ICON_BUTTON,
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
      className={`${buttonClassName} hover:text-blue-700`}
      title={`News for ${ticker}`}
      aria-label={`News ${ticker}`}
    >
      <i className={`fas fa-newspaper ${iconClassName}`}></i>
    </button>
  )
}

export default AssetNewsButton
