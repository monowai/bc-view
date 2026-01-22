import React from "react"
import { useTranslation } from "next-i18next"

interface TradeStatusToggleProps {
  isSettled: boolean
  onChange: (isSettled: boolean) => void
  disabled?: boolean
  size?: "sm" | "md"
}

/**
 * Toggle component for trade status (Proposed/Settled).
 * Off = Proposed, On = Settled
 */
const TradeStatusToggle: React.FC<TradeStatusToggleProps> = ({
  isSettled,
  onChange,
  disabled = false,
  size = "md",
}) => {
  const { t } = useTranslation("common")

  const toggleSize = size === "sm" ? "w-10 h-5" : "w-12 h-6"
  const dotSize = size === "sm" ? "w-4 h-4" : "w-5 h-5"
  const dotTranslate = size === "sm" ? "translate-x-5" : "translate-x-6"
  const textSize = size === "sm" ? "text-xs" : "text-sm"

  return (
    <div className="flex items-center gap-2">
      <span
        className={`${textSize} font-medium ${!isSettled ? "text-amber-600" : "text-gray-400"}`}
      >
        {t("trn.status.proposed", "Proposed")}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={isSettled}
        disabled={disabled}
        onClick={() => onChange(!isSettled)}
        className={`
          relative inline-flex ${toggleSize} items-center rounded-full transition-colors
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
          ${isSettled ? "bg-green-500" : "bg-amber-400"}
        `}
      >
        <span
          className={`
            inline-block ${dotSize} transform rounded-full bg-white shadow-md transition-transform
            ${isSettled ? dotTranslate : "translate-x-0.5"}
          `}
        />
      </button>
      <span
        className={`${textSize} font-medium ${isSettled ? "text-green-600" : "text-gray-400"}`}
      >
        {t("trn.status.settled", "Settled")}
      </span>
    </div>
  )
}

export default TradeStatusToggle
