import React, { useState } from "react"

interface TooltipProps {
  text: string
  children: React.ReactNode
  /** Show tooltip below instead of above. Use when near top of viewport. */
  position?: "above" | "below"
}

export default function Tooltip({
  text,
  children,
  position = "above",
}: TooltipProps): React.ReactElement {
  const [isVisible, setIsVisible] = useState(false)
  const isBelow = position === "below"

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      <i className="fas fa-info-circle ml-1 text-gray-400 hover:text-gray-600 cursor-help text-xs"></i>
      {isVisible && (
        <span
          className={`absolute z-50 left-1/2 transform -translate-x-1/2 px-3 py-2 text-xs text-white bg-gray-800 rounded-lg shadow-lg max-w-xs whitespace-normal text-center ${
            isBelow ? "top-full mt-2" : "bottom-full mb-2"
          }`}
        >
          {text}
          <span
            className={`absolute left-1/2 transform -translate-x-1/2 border-4 border-transparent ${
              isBelow
                ? "bottom-full border-b-gray-800"
                : "top-full border-t-gray-800"
            }`}
          ></span>
        </span>
      )}
    </span>
  )
}

/**
 * Inline tooltip that shows instantly on hover without an icon.
 * Use this to wrap content that should show a tooltip on hover.
 */
export function QuickTooltip({
  text,
  children,
}: TooltipProps): React.ReactElement {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <span
      className="relative inline-block cursor-help"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <span className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 text-xs text-white bg-gray-800 rounded shadow-lg whitespace-nowrap">
          {text}
          <span className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></span>
        </span>
      )}
    </span>
  )
}
