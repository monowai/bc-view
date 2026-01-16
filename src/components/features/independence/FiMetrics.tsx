import React from "react"
import InfoTooltip from "@components/ui/Tooltip"
import PrivateCurrency, {
  PrivatePercentage,
  HIDDEN_VALUE,
} from "@components/ui/PrivateCurrency"
import { usePrivacyMode } from "@hooks/usePrivacyMode"
import {
  calculateFiProgress,
  calculateGapToFi,
  calculateFiNumberFromMonthly,
  isFinanciallyIndependent,
  clampFiProgress,
  calculateCoastFiNumber,
  calculateCoastFiProgress,
  isCoastFireAchieved,
  calculateYearsToTarget,
  calculateSavingsRate,
  calculateBlendedReturnRate,
  calculateRealReturnRate,
} from "@utils/independence/fiCalculations"
import {
  getProgressBgColor,
  getProgressTextColor,
  getGapColorScheme,
  getSavingsRateTextColor,
} from "@utils/independence/fiColorThemes"
import FiAgeExplorer from "./FiAgeExplorer"

interface FiMetricsProps {
  /** Monthly expenses in retirement */
  monthlyExpenses: number
  /** Liquid (spendable) assets */
  liquidAssets: number
  /** Currency code (e.g., "NZD") */
  currency: string
  /** Monthly income during working years */
  workingIncomeMonthly?: number
  /** Monthly investment amount (pre-calculated from plan) */
  monthlyInvestment?: number
  /** Expected annual return rate (as decimal, e.g., 0.07 for 7%) */
  expectedReturnRate?: number
  /** Current age (for Coast FIRE calculation) */
  currentAge?: number
  /** Target retirement age (for Coast FIRE calculation) */
  retirementAge?: number
  /** Pre-calculated FI Number from backend (overrides local calculation) */
  backendFiNumber?: number
  /** Pre-calculated FI Progress from backend (overrides local calculation) */
  backendFiProgress?: number
  /** Pre-calculated Net Monthly Expenses from backend (expenses - income sources) */
  backendNetMonthlyExpenses?: number
  /** Pre-calculated Coast FI Number from backend */
  backendCoastFiNumber?: number
  /** Pre-calculated Coast FI Progress from backend */
  backendCoastFiProgress?: number
  /** Pre-calculated is Coast FIRE achieved from backend */
  backendIsCoastFire?: boolean
  /** Pre-calculated real years to FI (inflation-adjusted, matches online calculators) */
  backendRealYearsToFi?: number
  /** Warning: real return rate is below the 4% safe withdrawal rate */
  backendRealReturnBelowSwr?: boolean
  /** Current inflation rate from plan (as decimal) */
  inflationRate?: number
  /** Current equity return rate from plan (as decimal) */
  equityReturnRate?: number
  /** Current cash return rate from plan (as decimal) */
  cashReturnRate?: number
  /** Current equity allocation from plan (as decimal) */
  equityAllocation?: number
  /** Current cash allocation from plan (as decimal) */
  cashAllocation?: number
}

/**
 * Calculates and displays FIRE (Financial Independence, Retire Early) metrics:
 * - FI Number: 25× annual expenses (based on 4% safe withdrawal rate)
 * - Savings Rate: percentage of income saved during working years
 * - FI Progress: percentage towards financial independence
 * - Estimated years to FI based on current trajectory
 * - Coast FIRE Number: amount needed now to reach FI by retirement through growth alone
 */
export default function FiMetrics({
  monthlyExpenses,
  liquidAssets,
  currency,
  workingIncomeMonthly,
  monthlyInvestment,
  expectedReturnRate = 0.07,
  currentAge,
  retirementAge,
  backendFiNumber,
  backendFiProgress,
  backendNetMonthlyExpenses,
  backendCoastFiNumber,
  backendCoastFiProgress,
  backendIsCoastFire,
  backendRealYearsToFi,
  backendRealReturnBelowSwr,
  inflationRate = 0.025,
  equityReturnRate = 0.08,
  cashReturnRate = 0.03,
  equityAllocation = 0.8,
  cashAllocation = 0.2,
}: FiMetricsProps): React.ReactElement {
  const { hideValues } = usePrivacyMode()

  // FI Number = Annual Expenses × 25 (based on 4% SWR)
  // Use backend value if provided for consistency with PlanCard
  const localFiNumber = calculateFiNumberFromMonthly(monthlyExpenses)
  const fiNumber = backendFiNumber || localFiNumber

  // FI Progress and Gap - use shared utilities
  // Using || fallback to local calculation when backend returns 0
  const localFiProgress = calculateFiProgress(liquidAssets, fiNumber)
  const fiProgress = backendFiProgress || localFiProgress
  const fiProgressClamped = clampFiProgress(fiProgress)
  const isFi = isFinanciallyIndependent(fiProgress)

  // Always calculate Gap locally to ensure What-If changes are reflected
  const gapToFi = calculateGapToFi(fiNumber, liquidAssets)
  const gapColors = getGapColorScheme(gapToFi)

  // Savings Rate
  const savingsRate = calculateSavingsRate(
    monthlyInvestment ?? 0,
    workingIncomeMonthly ?? 0,
  )

  // Calculate estimated years to FI using compound interest formula
  const yearsToFi = calculateYearsToFiLocal(
    liquidAssets,
    (monthlyInvestment || 0) * 12,
    fiNumber,
    expectedReturnRate,
  )

  // Coast FIRE calculations
  const yearsToRetirement = calculateYearsToTarget(currentAge, retirementAge)
  const localCoastFiNumber = calculateCoastFiNumber(
    fiNumber,
    yearsToRetirement ?? 0,
    expectedReturnRate,
  )
  const coastFiNumber = backendCoastFiNumber ?? localCoastFiNumber
  const localCoastFiProgress = calculateCoastFiProgress(
    liquidAssets,
    coastFiNumber,
  )
  const coastFiProgress = backendCoastFiProgress ?? localCoastFiProgress
  const isCoastFire = backendIsCoastFire ?? isCoastFireAchieved(coastFiProgress)

  // Calculate real return rate for FI Age Explorer
  const blendedReturn = calculateBlendedReturnRate(
    cashReturnRate,
    equityReturnRate,
    cashAllocation,
    equityAllocation,
  )
  const realReturnRate = calculateRealReturnRate(blendedReturn, inflationRate)

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
        FIRE Metrics
        <InfoTooltip text="Financial Independence metrics based on the 4% safe withdrawal rate (25× expenses rule)">
          <span></span>
        </InfoTooltip>
      </h2>

      <div className="space-y-4">
        {/* FI Number */}
        <div className="p-4 bg-linear-to-r from-orange-50 to-amber-50 rounded-lg border border-orange-100">
          <div className="flex justify-between items-center">
            <div>
              <InfoTooltip text="Your FI Number is 25× your annual expenses. At this amount, a 4% annual withdrawal covers your expenses indefinitely.">
                <span className="text-sm text-gray-600 flex items-center gap-1">
                  <i className="fas fa-bullseye text-orange-500"></i>
                  FI Number (25×)
                </span>
              </InfoTooltip>
            </div>
            <span className="text-xl font-bold text-orange-600">
              <PrivateCurrency
                value={fiNumber}
                currency={currency}
                hideValues={hideValues}
              />
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {hideValues ? (
              <>Based on {HIDDEN_VALUE}/mo × 12 × 25</>
            ) : (
              <>
                Based on {currency}
                {Math.round(
                  backendNetMonthlyExpenses ?? monthlyExpenses,
                ).toLocaleString()}
                /mo net expenses × 12 × 25
              </>
            )}
          </p>
        </div>

        {/* FI Progress Bar */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">FI Progress</span>
            <PrivatePercentage
              value={fiProgress}
              hideValues={hideValues}
              className={`font-semibold ${getProgressTextColor(fiProgress)}`}
            />
          </div>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full ${getProgressBgColor(fiProgress)} transition-all duration-500`}
              style={{ width: hideValues ? "0%" : `${fiProgressClamped}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <PrivateCurrency
              value={liquidAssets}
              currency={currency}
              hideValues={hideValues}
            />
            <PrivateCurrency
              value={fiNumber}
              currency={currency}
              hideValues={hideValues}
            />
          </div>
          {/* Gap/Surplus to FI */}
          <div
            className={`flex justify-between items-center mt-3 p-2 rounded-lg ${gapColors.bg}`}
          >
            <InfoTooltip
              text={
                gapToFi <= 0
                  ? "You have exceeded your FI Number!"
                  : "The amount still needed to reach your FI Number"
              }
            >
              <span className="text-sm text-gray-600 flex items-center gap-1">
                <i className={`fas ${gapColors.icon}`}></i>
                {gapToFi <= 0 ? "FI Surplus" : "Gap to FI"}
              </span>
            </InfoTooltip>
            <span className={`font-semibold ${gapColors.text}`}>
              {hideValues ? (
                HIDDEN_VALUE
              ) : (
                <>
                  {gapToFi <= 0 ? "+" : ""}
                  {currency}
                  {Math.round(Math.abs(gapToFi)).toLocaleString()}
                </>
              )}
            </span>
          </div>
        </div>

        {/* Years to FI */}
        {yearsToFi !== null && yearsToFi > 0 && !isFi && (
          <div className="py-2 border-t border-gray-100">
            <div className="flex justify-between items-center">
              <InfoTooltip text="Estimated years until you reach your FI Number using nominal returns. The 'real' value uses inflation-adjusted returns (matches online FIRE calculators).">
                <span className="text-gray-600 flex items-center gap-2">
                  <i className="fas fa-calendar-alt text-blue-500"></i>
                  Years to FI
                  {currentAge && (
                    <span className="text-xs text-gray-400">
                      (age {currentAge} →{" "}
                      {currentAge +
                        Math.round(backendRealYearsToFi ?? yearsToFi)}
                      )
                    </span>
                  )}
                </span>
              </InfoTooltip>
              <span className="font-semibold text-gray-900">
                {hideValues
                  ? HIDDEN_VALUE
                  : backendRealYearsToFi
                    ? backendRealYearsToFi <= 1
                      ? "< 1 year"
                      : `~${Math.round(backendRealYearsToFi)} years`
                    : yearsToFi <= 1
                      ? "< 1 year"
                      : `~${Math.round(yearsToFi)} years`}
              </span>
            </div>
            {backendRealYearsToFi && !hideValues && (
              <p className="text-xs text-gray-500 mt-1">
                Using inflation-adjusted returns (nominal: ~
                {Math.round(yearsToFi)} years)
              </p>
            )}
          </div>
        )}

        {/* Coast FIRE */}
        {coastFiNumber !== null &&
          !isFi &&
          backendRealYearsToFi &&
          backendRealYearsToFi > 0 && (
            <div className="py-3 border-t border-gray-100">
              <div className="flex justify-between items-center mb-2">
                <InfoTooltip text="Coast FIRE is the amount you need invested today so that compound growth alone (no more contributions) will reach your FI Number by your FI achievement date.">
                  <span className="text-gray-600 flex items-center gap-2">
                    <i className="fas fa-ship text-purple-500"></i>
                    Coast FI Number
                  </span>
                </InfoTooltip>
                <span className="font-semibold text-purple-600">
                  <PrivateCurrency
                    value={coastFiNumber}
                    currency={currency}
                    hideValues={hideValues}
                  />
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">
                  Coast FI Progress ({Math.round(backendRealYearsToFi)}yr to FI
                  {currentAge &&
                    `, age ${currentAge + Math.round(backendRealYearsToFi)}`}
                  )
                </span>
                <span
                  className={`font-medium ${hideValues ? "text-gray-400" : isCoastFire ? "text-purple-600" : "text-gray-600"}`}
                >
                  {hideValues
                    ? HIDDEN_VALUE
                    : `${coastFiProgress?.toFixed(1)}%`}
                </span>
              </div>
              {!hideValues && !isCoastFire && currentAge && (
                <p className="text-xs text-gray-500 mt-1">
                  You have {currency}
                  {Math.round(liquidAssets).toLocaleString()} of {currency}
                  {Math.round(coastFiNumber).toLocaleString()} needed to coast
                  to FI by age {currentAge + Math.round(backendRealYearsToFi)}
                </p>
              )}
              {isCoastFire && !hideValues && currentAge && (
                <div className="mt-2 p-2 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-center gap-2 text-purple-700 text-sm">
                    <i className="fas fa-anchor"></i>
                    <span className="font-medium">Coast FIRE Achieved!</span>
                  </div>
                  <p className="text-xs text-purple-600 mt-1">
                    You could stop contributing now and still reach FI by age{" "}
                    {currentAge + Math.round(backendRealYearsToFi)} through
                    investment growth alone.
                  </p>
                </div>
              )}
            </div>
          )}

        {/* SWR Warning */}
        {backendRealReturnBelowSwr && !hideValues && !isFi && (
          <div className="mt-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <div className="flex items-center gap-2 text-amber-700">
              <i className="fas fa-exclamation-triangle"></i>
              <span className="font-medium">Low Real Return Warning</span>
            </div>
            <p className="text-xs text-amber-600 mt-1">
              Your real return (after inflation) is below the 4% safe withdrawal
              rate. This means traditional FIRE calculations may be optimistic.
              Consider increasing returns, reducing expenses, or planning for a
              longer working period.
            </p>
          </div>
        )}

        {/* FI Achieved */}
        {isFi && !hideValues && (
          <div className="mt-2 p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center gap-2 text-green-700">
              <i className="fas fa-check-circle"></i>
              <span className="font-medium">Financially Independent!</span>
            </div>
            <p className="text-xs text-green-600 mt-1">
              Your liquid assets exceed your FI Number. You could sustain your
              lifestyle indefinitely using the 4% rule.
            </p>
          </div>
        )}

        {/* Savings Rate - informational, doesn't affect FIRE calculations */}
        {savingsRate !== null && (
          <div className="flex justify-between items-center py-2 border-t border-gray-100">
            <InfoTooltip text="The percentage of your working income that goes towards savings/investments. Higher savings rates lead to faster FI.">
              <span className="text-gray-600 flex items-center gap-2">
                <i className="fas fa-piggy-bank text-green-500"></i>
                Savings Rate
              </span>
            </InfoTooltip>
            <div className="text-right">
              <PrivatePercentage
                value={savingsRate}
                hideValues={hideValues}
                className={`font-semibold ${hideValues ? "text-gray-400" : getSavingsRateTextColor(savingsRate)}`}
              />
              {monthlyInvestment !== undefined && (
                <div className="text-xs text-gray-500">
                  {hideValues ? (
                    HIDDEN_VALUE
                  ) : (
                    <>
                      {currency}
                      {Math.round(monthlyInvestment).toLocaleString()}/mo
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* FI Age Explorer */}
        {!isFi &&
          currentAge &&
          workingIncomeMonthly &&
          workingIncomeMonthly > 0 &&
          !hideValues && (
            <FiAgeExplorer
              liquidAssets={liquidAssets}
              fiNumber={fiNumber}
              currentAge={currentAge}
              monthlyInvestment={monthlyInvestment || 0}
              workingIncomeMonthly={workingIncomeMonthly}
              realReturnRate={realReturnRate}
              currency={currency}
            />
          )}
      </div>
    </div>
  )
}

/**
 * Calculate years to reach FI using binary search with compound interest.
 * FV = PV(1+r)^n + PMT × ((1+r)^n - 1) / r
 * Returns null if FI is not achievable.
 */
function calculateYearsToFiLocal(
  currentAssets: number,
  annualContribution: number,
  targetAmount: number,
  annualReturnRate: number,
): number | null {
  if (currentAssets >= targetAmount) return 0
  if (annualContribution <= 0 && currentAssets <= 0) return null

  if (annualReturnRate <= 0) {
    if (annualContribution <= 0) return null
    return (targetAmount - currentAssets) / annualContribution
  }

  // Binary search for years to reach target
  let low = 0
  let high = 100
  const tolerance = 0.1

  while (high - low > tolerance) {
    const mid = (low + high) / 2
    const fv = calculateFutureValue(
      currentAssets,
      annualContribution,
      annualReturnRate,
      mid,
    )

    if (fv < targetAmount) {
      low = mid
    } else {
      high = mid
    }
  }

  if (low >= 99.9) return null
  return (low + high) / 2
}

/**
 * Calculate future value with compound interest and regular contributions.
 */
function calculateFutureValue(
  presentValue: number,
  annualContribution: number,
  annualRate: number,
  years: number,
): number {
  const compoundFactor = Math.pow(1 + annualRate, years)
  const fvPresent = presentValue * compoundFactor
  const fvContributions =
    annualRate > 0
      ? annualContribution * ((compoundFactor - 1) / annualRate)
      : annualContribution * years

  return fvPresent + fvContributions
}
