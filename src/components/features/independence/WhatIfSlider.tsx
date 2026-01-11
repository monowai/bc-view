import React from "react"

interface WhatIfSliderProps {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step: number
  unit: string
  formatValue?: (v: number) => string
}

export default function WhatIfSlider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit,
  formatValue,
}: WhatIfSliderProps): React.ReactElement {
  const displayValue = formatValue
    ? formatValue(value)
    : `${value > 0 ? "+" : ""}${value}${unit}`
  const isPositive = value > 0
  const isNegative = value < 0

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <span
          className={`text-sm font-semibold ${
            isPositive
              ? "text-green-600"
              : isNegative
                ? "text-red-600"
                : "text-gray-600"
          }`}
        >
          {displayValue}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
      />
      <div className="flex justify-between text-xs text-gray-400">
        <span>{formatValue ? formatValue(min) : `${min}${unit}`}</span>
        <span>
          {formatValue
            ? formatValue(max)
            : `${max > 0 ? "+" : ""}${max}${unit}`}
        </span>
      </div>
    </div>
  )
}
