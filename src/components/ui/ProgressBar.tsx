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

interface AlphaProgressProps {
  irr: number
  lastTradeDate?: string
  className?: string
}

export const AlphaProgress: React.FC<AlphaProgressProps> = ({
  irr,
  lastTradeDate,
  className,
}) => {
  // Calculate time-weighted alpha
  const calculateTimeWeightedAlpha = (
    irr: number,
    lastTradeDate?: string,
  ): number => {
    if (!lastTradeDate) return irr

    const tradeDate = new Date(lastTradeDate)
    const now = new Date()
    const holdingPeriodYears =
      (now.getTime() - tradeDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)

    // Apply time penalty/bonus to alpha
    // Shorter holding periods get penalty, longer periods get stability bonus
    let timeFactor = 1
    if (holdingPeriodYears < 0.25) {
      timeFactor = 0.7 // 30% penalty for positions held < 3 months
    } else if (holdingPeriodYears < 1) {
      timeFactor = 0.85 // 15% penalty for positions held < 1 year
    } else if (holdingPeriodYears > 3) {
      timeFactor = 1.1 // 10% bonus for positions held > 3 years
    }

    return irr * timeFactor
  }

  const timeWeightedAlpha = calculateTimeWeightedAlpha(irr, lastTradeDate)

  // Determine color based on time-weighted alpha performance
  const getColor = (alpha: number): "blue" | "green" | "purple" | "gray" => {
    if (alpha >= 0.15) return "green" // 15%+ = green (excellent)
    if (alpha >= 0.08) return "blue" // 8-15% = blue (good)
    if (alpha >= 0.03) return "purple" // 3-8% = purple (fair)
    return "gray" // <3% = gray (poor)
  }

  // Calculate holding period for display
  const getHoldingPeriod = (lastTradeDate?: string): string => {
    if (!lastTradeDate) return ""

    const tradeDate = new Date(lastTradeDate)
    const now = new Date()
    const holdingPeriodYears =
      (now.getTime() - tradeDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)

    if (holdingPeriodYears < 1) {
      const months = Math.floor(holdingPeriodYears * 12)
      return `${months}m`
    }
    return `${holdingPeriodYears.toFixed(1)}y`
  }

  const holdingPeriod = getHoldingPeriod(lastTradeDate)

  return (
    <div className={`relative group flex items-center space-x-2 ${className}`}>
      <div className="text-xs font-medium min-w-[2rem] text-right">
        {holdingPeriod || "N/A"}
      </div>
      <div className="flex-1">
        <ProgressBar
          value={Math.abs(timeWeightedAlpha)}
          maxValue={0.3} // Show relative to 30% max for IRR scaling
          showLabel={false} // We'll show our own label
          size="sm"
          color={getColor(timeWeightedAlpha)}
        />
      </div>

      {/* Hover tooltip */}
      <div
        className="absolute -top-16 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded py-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap shadow-lg border border-gray-600"
        style={{ zIndex: 9999 }}
      >
        <div className="font-semibold">Time-Weighted Alpha</div>
        <div>Raw IRR: {(irr * 100).toFixed(1)}%</div>
        <div>Adjusted Alpha: {(timeWeightedAlpha * 100).toFixed(1)}%</div>
        {lastTradeDate && (
          <div className="mt-1 text-gray-300">
            Position opened: {new Date(lastTradeDate).toLocaleDateString()}
          </div>
        )}
        <div className="mt-1 text-gray-300">
          {holdingPeriod
            ? `Held for ${holdingPeriod}`
            : "Unknown holding period"}
        </div>
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
