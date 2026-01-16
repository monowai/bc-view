import React from "react"

const HIDDEN_VALUE = "****"

interface PrivateCurrencyProps {
  /** The numeric value to display */
  value: number
  /** Currency code (e.g., "NZD", "SGD") */
  currency: string
  /** Whether to hide values for privacy */
  hideValues: boolean
  /** Optional className for styling */
  className?: string
  /** Whether to show + prefix for positive values (default: false) */
  showPositivePrefix?: boolean
  /** Whether to show absolute value (default: false) */
  absolute?: boolean
}

/**
 * Privacy-aware currency display component.
 * Displays formatted currency value or hidden placeholder based on privacy mode.
 */
export default function PrivateCurrency({
  value,
  currency,
  hideValues,
  className,
  showPositivePrefix = false,
  absolute = false,
}: PrivateCurrencyProps): React.ReactElement {
  if (hideValues) {
    return (
      <span className={`text-gray-400 ${className ?? ""}`}>{HIDDEN_VALUE}</span>
    )
  }

  const displayValue = absolute ? Math.abs(value) : value
  const prefix = showPositivePrefix && value > 0 ? "+" : ""

  return (
    <span className={className}>
      {prefix}
      {currency}
      {Math.round(displayValue).toLocaleString()}
    </span>
  )
}

/**
 * Privacy-aware percentage display component.
 */
export function PrivatePercentage({
  value,
  hideValues,
  className,
  decimals = 1,
}: {
  value: number
  hideValues: boolean
  className?: string
  decimals?: number
}): React.ReactElement {
  if (hideValues) {
    return (
      <span className={`text-gray-400 ${className ?? ""}`}>{HIDDEN_VALUE}</span>
    )
  }

  return <span className={className}>{value.toFixed(decimals)}%</span>
}

export { HIDDEN_VALUE }
