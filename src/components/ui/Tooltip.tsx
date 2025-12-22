import React, { useState } from "react"

interface TooltipProps {
  text: string
  children: React.ReactNode
}

export default function Tooltip({
  text,
  children,
}: TooltipProps): React.ReactElement {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      <i className="fas fa-info-circle ml-1 text-gray-400 hover:text-gray-600 cursor-help text-xs"></i>
      {isVisible && (
        <span className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 text-xs text-white bg-gray-800 rounded-lg shadow-lg max-w-xs whitespace-normal text-center">
          {text}
          <span className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></span>
        </span>
      )}
    </span>
  )
}
