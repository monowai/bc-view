import React, { useState } from "react"
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
import type { ProjectionWarning } from "types/independence"

/** Warning messages for actual data quality issues */
const ProjectionWarningMessages: Record<string, string> = {
  ASSETS_FROM_FALLBACK:
    "Asset values could not be fetched from portfolio service - using fallback values",
  RENTAL_INCOME_UNAVAILABLE:
    "Rental income could not be fetched - calculations exclude rental income",
  NO_EXPENSES:
    "No monthly expenses configured - FI calculations require expenses to be meaningful",
}

/** Warnings that represent actual data quality issues (not just valid empty states) */
const ERROR_WARNINGS: ProjectionWarning[] = [
  "ASSETS_FROM_FALLBACK",
  "RENTAL_INCOME_UNAVAILABLE",
  "NO_EXPENSES",
]

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
  /** Data quality warnings from backend */
  warnings?: ProjectionWarning[]
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
  warnings = [],
}: FiSummaryBarProps): React.ReactElement {
  const { hideValues } = usePrivacyMode()
  const [showWarnings, setShowWarnings] = useState(false)

  // Filter warnings to only show actual errors (not valid empty states like "no assets")
  const errorWarnings = warnings.filter((w) => ERROR_WARNINGS.includes(w))

  // Use backend FI Progress if valid and > 0, otherwise calculate locally
  // Using || ensures we fallback to local calculation when backend returns 0
  // (e.g., when currency mismatch prevents passing assets to backend)
  const localFiProgress = calculateFiProgress(liquidAssets, fiNumber)
  const fiProgress = backendFiProgress || localFiProgress
  const fiProgressClamped = clampFiProgress(fiProgress)
  const isFi = isFinanciallyIndependent(fiProgress)

  // Always calculate Gap locally using current liquidAssets
  // This ensures What-If scenario changes are reflected immediately
  const gapToFi = calculateGapToFi(fiNumber, liquidAssets)
  const gapColors = getGapColorScheme(gapToFi)

  const hasWarnings = errorWarnings.length > 0

  return (
    <div className="space-y-2 mb-4">
      {/* Warning banner - only shows actual backend errors, not valid empty states */}
      {hasWarnings && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <button
            onClick={() => setShowWarnings(!showWarnings)}
            className="w-full flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <i className="fas fa-exclamation-triangle text-amber-500"></i>
              <span className="text-sm font-medium text-amber-800">
                Data quality warning ({errorWarnings.length})
              </span>
            </div>
            <i
              className={`fas fa-chevron-${showWarnings ? "up" : "down"} text-amber-500 text-xs`}
            ></i>
          </button>
          {showWarnings && (
            <ul className="mt-2 space-y-1 text-sm text-amber-700">
              {errorWarnings.map((warning) => (
                <li key={warning} className="flex items-start gap-2">
                  <i className="fas fa-circle text-[4px] mt-2 text-amber-400"></i>
                  <span>{ProjectionWarningMessages[warning]}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* FIRE metrics bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
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
    </div>
  )
}
