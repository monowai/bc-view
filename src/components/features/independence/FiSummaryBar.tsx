import React from "react"
import { usePrivacyMode } from "@hooks/usePrivacyMode"
import PrivateCurrency, {
  PrivatePercentage,
  HIDDEN_VALUE,
} from "@components/ui/PrivateCurrency"
import {
  calculateFiProgress,
  calculateGapToFi,
  isFinanciallyIndependent,
  clampFiProgress,
} from "@utils/independence/fiCalculations"
import {
  getProgressBgColor,
  getProgressTextColor,
  getGapColorScheme,
} from "@utils/independence/fiColorThemes"

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
  const localFiProgress = calculateFiProgress(liquidAssets, fiNumber)
  const fiProgress = backendFiProgress ?? localFiProgress
  const fiProgressClamped = clampFiProgress(fiProgress)
  const isFi = isFinanciallyIndependent(fiProgress)

  // Always calculate Gap locally using current liquidAssets
  // This ensures What-If scenario changes are reflected immediately
  const gapToFi = calculateGapToFi(fiNumber, liquidAssets)
  const gapColors = getGapColorScheme(gapToFi)

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
              <PrivatePercentage
                value={fiProgress}
                hideValues={hideValues}
                className={`text-lg font-bold ${getProgressTextColor(fiProgress)}`}
              />
              {isFi && !hideValues && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                  FI!
                </span>
              )}
            </div>
          </div>
          {/* Mini progress bar */}
          <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full ${getProgressBgColor(fiProgress)} transition-all duration-500`}
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
          <PrivateCurrency
            value={fiNumber}
            currency={currency}
            hideValues={hideValues}
            className="text-lg font-semibold text-gray-900"
          />
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-gray-200" />

        {/* Gap to FI - green if exceeded (negative), orange/red if deficit (positive) */}
        <div className="flex flex-col">
          <span className="text-xs text-gray-500 uppercase tracking-wide">
            {gapToFi <= 0 ? "FI Surplus" : "Gap to FI"}
          </span>
          <span className={`text-lg font-semibold ${gapColors.text}`}>
            {hideValues ? (
              <span className="text-gray-400">{HIDDEN_VALUE}</span>
            ) : (
              <>
                {gapToFi <= 0 ? "+" : ""}
                {currency}
                {Math.round(Math.abs(gapToFi)).toLocaleString()}
              </>
            )}
          </span>
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-gray-200" />

        {/* Assets breakdown */}
        <div className="flex flex-col">
          <span className="text-xs text-gray-500 uppercase tracking-wide">
            Liquid Assets
          </span>
          <PrivateCurrency
            value={liquidAssets}
            currency={currency}
            hideValues={hideValues}
            className="text-lg font-semibold text-gray-900"
          />
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
