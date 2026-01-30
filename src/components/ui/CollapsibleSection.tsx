import React, { useState } from "react"

interface CollapsibleSectionProps {
  title: string
  icon?: string
  iconColor?: string
  defaultOpen?: boolean
  isOpen?: boolean
  onToggle?: () => void
  headerRight?: React.ReactNode
  children: React.ReactNode
}

export default function CollapsibleSection({
  title,
  icon,
  iconColor = "text-blue-500",
  defaultOpen = true,
  isOpen: controlledOpen,
  onToggle,
  headerRight,
  children,
}: CollapsibleSectionProps): React.ReactElement {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : internalOpen

  const handleToggle = (): void => {
    if (isControlled && onToggle) {
      onToggle()
    } else {
      setInternalOpen(!internalOpen)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center justify-between">
        <button
          onClick={handleToggle}
          className="flex items-center gap-2 text-lg font-semibold text-gray-900 hover:text-gray-700 transition-colors"
        >
          {icon && <i className={`fas ${icon} ${iconColor}`}></i>}
          {title}
          <i
            className={`fas fa-chevron-down text-sm text-gray-400 transition-transform ${
              isOpen ? "" : "-rotate-90"
            }`}
          ></i>
        </button>
        {isOpen && headerRight}
      </div>
      {isOpen && <div className="mt-4">{children}</div>}
    </div>
  )
}
