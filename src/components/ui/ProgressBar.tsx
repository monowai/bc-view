import React from "react"

interface ProgressBarProps {
  value: number
  maxValue?: number
  showLabel?: boolean
  size?: "sm" | "md" | "lg"
  color?: "blue" | "green" | "red" | "purple" | "gray"
  className?: string
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  maxValue = 100,
  showLabel = true,
  size = "sm",
  color = "blue",
  className = "",
}) => {
  const percentage = Math.min((value / maxValue) * 100, 100)
  const displayValue = value * 100 // Assuming weight comes as decimal (0.15 = 15%)

  const sizeClasses = {
    sm: "h-1.5",
    md: "h-2",
    lg: "h-3",
  }

  const colorClasses = {
    blue: "bg-blue-500",
    green: "bg-green-500",
    red: "bg-red-500",
    purple: "bg-purple-500",
    gray: "bg-gray-500",
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {showLabel && (
        <span className="text-xs text-gray-600 min-w-[3rem] text-right">
          {displayValue.toFixed(1)}%
        </span>
      )}
      <div
        className={`flex-1 bg-gray-200 rounded-full ${sizeClasses[size]} min-w-[3rem]`}
      >
        <div
          className={`${sizeClasses[size]} ${colorClasses[color]} rounded-full transition-all duration-300 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

interface WeightProgressProps {
  weight: number
  className?: string
}

export const WeightProgress: React.FC<WeightProgressProps> = ({
  weight,
  className,
}) => {
  // Determine color based on weight size
  const getColor = (weight: number): "blue" | "green" | "purple" | "gray" => {
    if (weight >= 0.1) return "green" // 10%+ = green (large position)
    if (weight >= 0.05) return "blue" // 5-10% = blue (medium position)
    if (weight >= 0.01) return "purple" // 1-5% = purple (small position)
    return "gray" // <1% = gray (tiny position)
  }

  return (
    <ProgressBar
      value={weight}
      maxValue={0.5} // Show relative to 50% max for better visual scaling
      showLabel={true}
      size="sm"
      color={getColor(weight)}
      className={className}
    />
  )
}

export default ProgressBar
