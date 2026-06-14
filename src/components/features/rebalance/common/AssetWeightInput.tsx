import React, { useState } from "react"
import MathInput from "@components/ui/MathInput"

const UUID_RE =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[A-Za-z0-9_-]{22})$/i

interface AssetWeightInputProps {
  assetId: string
  assetCode?: string
  assetName?: string
  weight: number
  rationale?: string
  capturedPrice?: number
  priceCurrency?: string
  onChange: (weight: number) => void
  onRationaleChange?: (rationale: string) => void
  onPriceChange?: (price: number | undefined) => void
  onRemove?: () => void
  onShowPriceChart?: () => void
  onShowAssetInsight?: () => void
  readOnly?: boolean
  showPrice?: boolean
}

const AssetWeightInput: React.FC<AssetWeightInputProps> = ({
  assetId,
  assetCode,
  assetName,
  weight,
  rationale,
  capturedPrice,
  priceCurrency,
  onChange,
  onRationaleChange,
  onPriceChange,
  onRemove,
  onShowPriceChart,
  onShowAssetInsight,
  readOnly = false,
  showPrice = false,
}) => {
  const isResolved = UUID_RE.test(assetId)
  const [showRationale, setShowRationale] = useState(!!rationale)

  return (
    <div className="p-3 bg-gray-50 rounded-lg">
      {/* Mobile: stack vertically, Desktop: horizontal */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        {/* Asset info - always visible */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{assetCode || assetId}</span>
            {onShowPriceChart && isResolved && (
              <button
                type="button"
                onClick={onShowPriceChart}
                className="p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
                title={"Price history chart"}
              >
                <i className="fas fa-chart-line text-xs"></i>
              </button>
            )}
            {onShowAssetInsight && isResolved && (
              <button
                type="button"
                onClick={onShowAssetInsight}
                className="p-0.5 text-gray-400 hover:text-blue-500 transition-colors"
                title={"AI asset insight"}
              >
                <i className="fas fa-robot text-xs"></i>
              </button>
            )}
          </div>
          {assetName && (
            <div className="text-xs text-gray-500 truncate">{assetName}</div>
          )}
        </div>
        {/* Inputs and actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {showPrice && (
            <>
              <MathInput
                value={capturedPrice ?? 0}
                placeholder={"Price"}
                onChange={(value) => {
                  onPriceChange?.(value > 0 ? value : undefined)
                }}
                disabled={readOnly}
                className="w-20 sm:w-24 px-2 py-1 text-right border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
              />
              <span className="text-gray-400 text-xs w-8">
                {priceCurrency || ""}
              </span>
            </>
          )}
          <MathInput
            value={weight}
            onChange={(value) => {
              // Clamp to 0-100 and round to 2 decimal places
              const clamped = Math.max(0, Math.min(100, value))
              onChange(Math.round(clamped * 100) / 100)
            }}
            disabled={readOnly}
            className="w-20 sm:w-24 px-2 py-1 text-right border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
          />
          <span className="text-gray-500">%</span>
          {onRationaleChange && !readOnly && (
            <button
              type="button"
              onClick={() => setShowRationale(!showRationale)}
              className={`p-1 transition-colors ${
                rationale
                  ? "text-blue-600 hover:text-blue-800"
                  : "text-gray-400 hover:text-gray-600"
              }`}
              title={"Investment rationale"}
            >
              <i className="fas fa-comment-alt"></i>
            </button>
          )}
          {rationale && readOnly && (
            <button
              type="button"
              onClick={() => setShowRationale(!showRationale)}
              className="p-1 text-blue-600 hover:text-blue-800 transition-colors"
              title={"Investment rationale"}
            >
              <i className="fas fa-comment-alt"></i>
            </button>
          )}
          {onRemove && !readOnly && (
            <button
              type="button"
              onClick={onRemove}
              className="p-1 text-red-500 hover:text-red-700 transition-colors"
              title={"Remove"}
            >
              <i className="fas fa-times"></i>
            </button>
          )}
        </div>
      </div>
      {showRationale && (
        <div className="mt-2">
          {readOnly ? (
            <p className="text-sm text-gray-600 italic">{rationale}</p>
          ) : (
            <textarea
              value={rationale || ""}
              onChange={(e) => onRationaleChange?.(e.target.value)}
              placeholder={"Why include this asset? (optional)"}
              rows={2}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          )}
        </div>
      )}
    </div>
  )
}

export default AssetWeightInput
