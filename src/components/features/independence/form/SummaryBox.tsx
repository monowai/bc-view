import React from "react"
import { formatCurrency } from "@lib/independence/formatters"

export interface SummaryItem {
  icon: string
  label: string
  value: number
  format?: "currency" | "percent" | "number"
  valueClassName?: string
}

interface SummaryBoxProps {
  items: SummaryItem[]
  color?: "blue" | "green" | "orange" | "red"
  description?: string
}

const colorClasses = {
  blue: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    icon: "text-blue-600",
    label: "text-blue-800",
    value: "text-blue-700",
    description: "text-blue-700",
  },
  green: {
    bg: "bg-green-50",
    border: "border-green-200",
    icon: "text-green-600",
    label: "text-green-800",
    value: "text-green-700",
    description: "text-green-700",
  },
  orange: {
    bg: "bg-independence-50",
    border: "border-independence-200",
    icon: "text-independence-600",
    label: "text-independence-700",
    value: "text-independence-700",
    description: "text-independence-700",
  },
  red: {
    bg: "bg-red-50",
    border: "border-red-200",
    icon: "text-red-600",
    label: "text-red-800",
    value: "text-red-700",
    description: "text-red-700",
  },
}

function formatValue(value: number, format?: SummaryItem["format"]): string {
  switch (format) {
    case "currency":
      return formatCurrency(value)
    case "percent":
      return `${value.toFixed(1)}%`
    case "number":
    default:
      return value.toLocaleString()
  }
}

export default function SummaryBox({
  items,
  color = "blue",
  description,
}: SummaryBoxProps): React.ReactElement {
  const colors = colorClasses[color]

  return (
    <div
      className={`${colors.bg} border ${colors.border} rounded-lg p-4 space-y-3`}
    >
      {items.map((item, index) => (
        <div key={index} className="flex justify-between items-center">
          <div className="flex items-center">
            <i className={`fas ${item.icon} ${colors.icon} mr-3`}></i>
            <span className={`font-medium ${colors.label}`}>{item.label}</span>
          </div>
          <span
            className={`text-xl font-bold ${item.valueClassName || colors.value}`}
          >
            {formatValue(item.value, item.format)}
          </span>
        </div>
      ))}
      {description && (
        <p className={`text-sm ${colors.description}`}>{description}</p>
      )}
    </div>
  )
}
