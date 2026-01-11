import React from "react"
import { usePrivacyMode } from "@hooks/usePrivacyMode"

const HIDDEN_VALUE = "****"

interface FiSummaryBarProps {
  /** FI Number (25x annual expenses) */
  fiNumber: number
  /** Current liquid assets */
  liquidAssets: number
  /** Non-spendable/illiquid assets */
  illiquidAssets: number
  /** Currency code */
  currency: string
  /** Whether Coast FIRE is achieved */
  isCoastFire?: boolean
  /** Years to retirement (for Coast FIRE context) */
  yearsToRetirement?: number
  /** Pre-calculated FI Progress from backend (overrides local calculation) */
  backendFiProgress?: number
}

/**
 * Compact summary bar showing key FIRE metrics.
 * Always visible at top of plan view regardless of active tab.
 */
export default function FiSummaryBar({
  fiNumber,
  liquidAssets,
  illiquidAssets,
  currency,
  isCoastFire,
  yearsToRetirement,
  backendFiProgress,
}: FiSummaryBarProps): React.ReactElement {
  const { hideValues } = usePrivacyMode()

  // Use backend FI Progress if provided, otherwise calculate locally
  const localFiProgress = fiNumber > 0 ? (liquidAssets / fiNumber) * 100 : 0
  const fiProgress = backendFiProgress ?? localFiProgress
  const fiProgressClamped = Math.min(fiProgress, 100)
  const isFinanciallyIndependent = fiProgress >= 100

  const getProgressColor = (): string => {
    if (fiProgress >= 100) return "bg-green-500"
    if (fiProgress >= 75) return "bg-blue-500"
    if (fiProgress >= 50) return "bg-yellow-500"
    return "bg-orange-500"
  }

  const getProgressTextColor = (): string => {
    if (fiProgress >= 100) return "text-green-600"
    if (fiProgress >= 75) return "text-blue-600"
    if (fiProgress >= 50) return "text-yellow-600"
    return "text-orange-600"
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
      <div className="flex flex-wrap items-center gap-6">
        {/* FI Progress */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-xs text-gray-500 uppercase tracking-wide">
              FI Progress
            </span>
            <div className="flex items-center gap-2">
              <span className={`text-lg font-bold ${getProgressTextColor()}`}>
                {hideValues ? HIDDEN_VALUE : `${fiProgress.toFixed(1)}%`}
              </span>
              {isFinanciallyIndependent && !hideValues && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                  FI!
                </span>
              )}
            </div>
          </div>
          {/* Mini progress bar */}
          <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full ${getProgressColor()} transition-all duration-500`}
              style={{ width: hideValues ? "0%" : `${fiProgressClamped}%` }}
            />
          </div>
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-gray-200" />

        {/* FI Number */}
        <div className="flex flex-col">
          <span className="text-xs text-gray-500 uppercase tracking-wide">
            FI Number
          </span>
          <span className="text-lg font-semibold text-gray-900">
            {hideValues ? (
              <span className="text-gray-400">{HIDDEN_VALUE}</span>
            ) : (
              <>
                {currency}
                {Math.round(fiNumber).toLocaleString()}
              </>
            )}
          </span>
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-gray-200" />

        {/* Gap to FI - only show if not yet FI */}
        {!isFinanciallyIndependent && (
          <>
            <div className="flex flex-col">
              <span className="text-xs text-gray-500 uppercase tracking-wide">
                Gap to FI
              </span>
              <span className="text-lg font-semibold text-orange-600">
                {hideValues ? (
                  <span className="text-gray-400">{HIDDEN_VALUE}</span>
                ) : (
                  <>
                    {currency}
                    {Math.round(fiNumber - liquidAssets).toLocaleString()}
                  </>
                )}
              </span>
            </div>

            {/* Divider */}
            <div className="h-8 w-px bg-gray-200" />
          </>
        )}

        {/* Assets breakdown */}
        <div className="flex flex-col">
          <span className="text-xs text-gray-500 uppercase tracking-wide">
            Liquid Assets
          </span>
          <span className="text-lg font-semibold text-gray-900">
            {hideValues ? (
              <span className="text-gray-400">{HIDDEN_VALUE}</span>
            ) : (
              <>
                {currency}
                {Math.round(liquidAssets).toLocaleString()}
              </>
            )}
          </span>
        </div>

        {illiquidAssets > 0 && (
          <>
            {/* Divider */}
            <div className="h-8 w-px bg-gray-200" />

            {/* Illiquid assets */}
            <div className="flex flex-col">
              <span className="text-xs text-gray-500 uppercase tracking-wide">
                Illiquid
              </span>
              <span className="text-sm text-gray-600">
                {hideValues ? (
                  <span className="text-gray-400">{HIDDEN_VALUE}</span>
                ) : (
                  <>
                    +{currency}
                    {Math.round(illiquidAssets).toLocaleString()}
                  </>
                )}
              </span>
            </div>
          </>
        )}

        {/* Coast FIRE status */}
        {isCoastFire !== undefined && yearsToRetirement && !hideValues && (
          <>
            {/* Divider */}
            <div className="h-8 w-px bg-gray-200" />

            <div className="flex flex-col">
              <span className="text-xs text-gray-500 uppercase tracking-wide">
                Coast FIRE
              </span>
              {isCoastFire ? (
                <span className="text-sm font-medium text-purple-600">
                  <i className="fas fa-anchor mr-1"></i>
                  Achieved
                </span>
              ) : (
                <span className="text-sm text-gray-600">
                  {yearsToRetirement}yr to go
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
