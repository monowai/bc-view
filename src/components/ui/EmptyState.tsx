import React from "react"

interface EmptyStateProps {
  icon?: string
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export default function EmptyState({
  icon = "fas fa-inbox",
  title,
  description,
  action,
  className = "",
}: EmptyStateProps): React.ReactElement {
  return (
    <div className={`text-center py-12 ${className}`}>
      <i className={`${icon} block text-4xl text-gray-300 mb-4`}></i>
      <p className="text-gray-500 text-lg">{title}</p>
      {description && (
        <p className="text-gray-400 text-sm mt-1">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
