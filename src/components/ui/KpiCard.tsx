import React from "react"

const TONE_CLASSES = {
  default: "text-gray-900",
  positive: "text-green-600",
  negative: "text-red-600",
  warning: "text-amber-600",
} as const

export type KpiTone = keyof typeof TONE_CLASSES

/**
 * Compact stat tile: small gray label, large tabular value, optional
 * sub-label and delta chip. Shared by the Summary and FI Overview tabs.
 */
export default function KpiCard({
  label,
  value,
  sub,
  tone = "default",
  chip,
  chipTone = "default",
}: {
  label: string
  value: string
  sub?: string
  /** Color of the headline value. */
  tone?: KpiTone
  /** Optional small rounded chip after the sub-label (e.g. a delta vs plan). */
  chip?: string
  chipTone?: KpiTone
}): React.ReactElement {
  const chipBg =
    chipTone === "negative"
      ? "bg-red-50 text-red-700"
      : chipTone === "positive"
        ? "bg-green-50 text-green-700"
        : chipTone === "warning"
          ? "bg-amber-50 text-amber-700"
          : "bg-gray-100 text-gray-600"
  return (
    <div className="flex flex-col">
      <span className="text-xs text-gray-500">{label}</span>
      <span
        className={`mt-0.5 text-2xl font-bold tabular-nums leading-none ${TONE_CLASSES[tone]}`}
      >
        {value}
      </span>
      {sub && <span className="mt-1 text-xs text-gray-500">{sub}</span>}
      {chip && (
        <span
          className={`mt-1 self-start rounded-full px-2 py-0.5 text-xs font-medium ${chipBg}`}
        >
          {chip}
        </span>
      )}
    </div>
  )
}
