import React from "react"
interface WeightsSummaryProps {
  totalWeight: number
  assetCount: number
}

const WeightsSummary: React.FC<WeightsSummaryProps> = ({
  totalWeight,
  assetCount,
}) => {
  const isValid = Math.abs(totalWeight - 100) < 0.01

  return (
    <div
      className={`flex items-center justify-between p-3 rounded-lg ${
        isValid
          ? "bg-green-50 border border-green-200"
          : "bg-red-50 border border-red-200"
      }`}
    >
      <div className="flex items-center gap-2">
        <i
          className={`fas ${isValid ? "fa-check-circle text-green-500" : "fa-exclamation-circle text-red-500"}`}
        ></i>
        <span className="text-sm">{`${assetCount} assets`}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{"Total Weight"}:</span>
        <span
          className={`font-bold ${isValid ? "text-green-700" : "text-red-700"}`}
        >
          {totalWeight.toFixed(2)}%
        </span>
      </div>
    </div>
  )
}

export default WeightsSummary
