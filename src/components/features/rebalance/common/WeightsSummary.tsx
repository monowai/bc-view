import React from "react"
interface WeightsSummaryProps {
  totalWeight: number
  assetCount: number
  /** When set and the total is off 100%, the bar offers the fix in place. */
  onNormalize?: () => void
}

const WeightsSummary: React.FC<WeightsSummaryProps> = ({
  totalWeight,
  assetCount,
  onNormalize,
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
      <div className="flex items-center gap-3">
        {!isValid && onNormalize && (
          <button
            type="button"
            onClick={onNormalize}
            className="text-sm font-medium text-red-700 underline hover:no-underline"
          >
            {"Normalize to 100%"}
          </button>
        )}
        <span className="text-sm font-medium">{"Total Weight"}:</span>
        <span
          className={`font-mono tabular-nums font-semibold ${isValid ? "text-green-700" : "text-red-700"}`}
        >
          {totalWeight.toFixed(2)}%
        </span>
      </div>
    </div>
  )
}

export default WeightsSummary
