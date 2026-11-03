import React from "react"
import {
  clampWeightPercent,
  normalizeWeights,
  weightsSumValid,
} from "@lib/rebalance/weights"
import { AssetWeightWithDetails } from "types/rebalance"

interface HoldingWeightsEditorProps {
  weights: AssetWeightWithDetails[]
  totalWeight: number
  onChange: (weights: AssetWeightWithDetails[]) => void
  headerClassName?: string
}

/** Editable target weights for holdings, with a fix for totals off 100%. */
const HoldingWeightsEditor: React.FC<HoldingWeightsEditorProps> = ({
  weights,
  totalWeight,
  onChange,
  headerClassName = "flex items-center justify-between",
}) => {
  const handleNormalize = (): void => {
    const normalized = normalizeWeights(weights, totalWeight)
    if (!normalized) return
    onChange(normalized)
  }

  return (
    <>
      <div className={headerClassName}>
        <label className="block text-sm font-medium text-gray-700">
          {"Target Allocations"}
        </label>
        {weights.length > 0 && !weightsSumValid(totalWeight) && (
          <button
            type="button"
            onClick={handleNormalize}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {"Normalize to 100%"}
          </button>
        )}
      </div>

      {weights.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-gray-500">
          {"No eligible assets found in holdings"}
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {weights.map((weight, index) => (
            <div
              key={weight.assetId}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">
                  {weight.assetCode}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {weight.assetName}
                </div>
              </div>
              <div className="text-xs text-gray-400">
                {weight.currentWeight?.toFixed(1)}%
              </div>
              <div className="flex items-center gap-1">
                <i className="fas fa-arrow-right text-gray-400 text-xs"></i>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={weight.weight}
                  onChange={(e) => {
                    const value = clampWeightPercent(
                      parseFloat(e.target.value) || 0,
                    )
                    const updated = [...weights]
                    updated[index] = {
                      ...updated[index],
                      weight: Math.round(value * 100) / 100, // Round to 2dp
                    }
                    onChange(updated)
                  }}
                  className="w-20 px-2 py-1 text-right border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                />
                <span className="text-gray-500">%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

export default HoldingWeightsEditor
