import React from "react"
import { useTranslation } from "next-i18next"

// Status color configurations for different status types
export const STATUS_COLORS = {
  // Plan statuses
  DRAFT: "bg-gray-100 text-gray-700",
  CALCULATING: "bg-yellow-100 text-yellow-700",
  READY: "bg-green-100 text-green-700",
  EXECUTING: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-purple-100 text-purple-700",
  CANCELLED: "bg-red-100 text-red-700",
  // Execution statuses
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  // Model plan statuses
  APPROVED: "bg-green-100 text-green-800",
} as const

type StatusKey = keyof typeof STATUS_COLORS

interface StatusBadgeProps {
  status: string
  /** i18n key prefix, e.g., "rebalance.plans.status" or "rebalance.execution.status" */
  i18nPrefix?: string
  /** Custom color class override */
  colorClass?: string
}

/**
 * Generic status badge component for displaying various status types
 * with consistent styling and i18n support.
 */
const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  i18nPrefix,
  colorClass,
}) => {
  const { t } = useTranslation("common")

  // Convert status to i18n key (lowercase, replace underscores with hyphens)
  const statusKey = status.toLowerCase().replace(/_/g, "-")
  const label = i18nPrefix ? t(`${i18nPrefix}.${statusKey}`, status) : status

  // Get color from config or use default
  const resolvedColorClass =
    colorClass ||
    STATUS_COLORS[status as StatusKey] ||
    "bg-gray-100 text-gray-700"

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${resolvedColorClass}`}
    >
      {label}
    </span>
  )
}

export default StatusBadge
