import React from "react"
import InfoTooltip from "@components/ui/Tooltip"
import { usePrivacyMode } from "@hooks/usePrivacyMode"

const HIDDEN_VALUE = "****"

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
}

/**
 * Privacy-aware currency display helper
 */
function PrivateCurrency({
  value,
  currency,
  hideValues,
}: {
  value: number
  currency: string
  hideValues: boolean
}): React.ReactElement {
  if (hideValues) {
    return <span className="text-gray-400">{HIDDEN_VALUE}</span>
  }
  return (
    <>
      {currency}
      {Math.round(value).toLocaleString()}
    </>
  )
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
}: FiMetricsProps): React.ReactElement {
  const { hideValues } = usePrivacyMode()

  // FI Number = Annual Expenses × 25 (based on 4% SWR)
  const annualExpenses = monthlyExpenses * 12
  const fiNumber = annualExpenses * 25

  // FI Progress = (Liquid Assets / FI Number) × 100
  const fiProgress = fiNumber > 0 ? (liquidAssets / fiNumber) * 100 : 0
  const fiProgressClamped = Math.min(fiProgress, 100)

  // Savings Rate = Monthly Investment / Income × 100
  // Uses the pre-calculated monthlyInvestment from the plan (accounts for investment allocation %)
  const savingsRate =
    workingIncomeMonthly && workingIncomeMonthly > 0 && monthlyInvestment
      ? (monthlyInvestment / workingIncomeMonthly) * 100
      : null

  // Calculate estimated years to FI using compound interest formula
  // FV = PV(1+r)^n + PMT × ((1+r)^n - 1) / r
  // Solving for n when FV = fiNumber
  const yearsToFi = calculateYearsToFi(
    liquidAssets,
    (monthlyInvestment || 0) * 12, // Annual contribution
    fiNumber,
    expectedReturnRate,
  )

  // Coast FIRE calculations
  // Coast FI Number = FI Number / (1 + returnRate)^yearsToRetirement
  // This is the amount you need now such that compound growth alone reaches FI
  const yearsToRetirement =
    currentAge && retirementAge && retirementAge > currentAge
      ? retirementAge - currentAge
      : null
  const coastFiNumber =
    yearsToRetirement && expectedReturnRate > 0
      ? fiNumber / Math.pow(1 + expectedReturnRate, yearsToRetirement)
      : null
  const coastFiProgress =
    coastFiNumber && coastFiNumber > 0
      ? (liquidAssets / coastFiNumber) * 100
      : null
  const isCoastFire = coastFiProgress !== null && coastFiProgress >= 100

  // Determine status color based on progress
  const getProgressColor = (): string => {
    if (fiProgress >= 100) return "text-green-600"
    if (fiProgress >= 75) return "text-blue-600"
    if (fiProgress >= 50) return "text-yellow-600"
    return "text-orange-600"
  }

  const getProgressBgColor = (): string => {
    if (fiProgress >= 100) return "bg-green-500"
    if (fiProgress >= 75) return "bg-blue-500"
    if (fiProgress >= 50) return "bg-yellow-500"
    return "bg-orange-500"
  }

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
        <div className="p-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg border border-orange-100">
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
                {monthlyExpenses.toLocaleString()}/mo × 12 × 25
              </>
            )}
          </p>
        </div>

        {/* FI Progress Bar */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">FI Progress</span>
            <span className={`font-semibold ${getProgressColor()}`}>
              {hideValues ? HIDDEN_VALUE : `${fiProgress.toFixed(1)}%`}
            </span>
          </div>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full ${getProgressBgColor()} transition-all duration-500`}
              style={{ width: hideValues ? "0%" : `${fiProgressClamped}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>
              <PrivateCurrency
                value={liquidAssets}
                currency={currency}
                hideValues={hideValues}
              />
            </span>
            <span>
              <PrivateCurrency
                value={fiNumber}
                currency={currency}
                hideValues={hideValues}
              />
            </span>
          </div>
          {/* Gap to FI */}
          {fiProgress < 100 && (
            <div className="flex justify-between items-center mt-3 p-2 bg-gray-50 rounded-lg">
              <InfoTooltip text="The amount still needed to reach your FI Number">
                <span className="text-sm text-gray-600 flex items-center gap-1">
                  <i className="fas fa-arrow-up text-orange-400"></i>
                  Gap to FI
                </span>
              </InfoTooltip>
              <span className="font-semibold text-orange-600">
                <PrivateCurrency
                  value={fiNumber - liquidAssets}
                  currency={currency}
                  hideValues={hideValues}
                />
              </span>
            </div>
          )}
        </div>

        {/* Savings Rate - percentages can reveal info, so hide */}
        {savingsRate !== null && (
          <div className="flex justify-between items-center py-2 border-t border-gray-100">
            <InfoTooltip text="The percentage of your working income that goes towards savings/investments. Higher savings rates lead to faster FI.">
              <span className="text-gray-600 flex items-center gap-2">
                <i className="fas fa-piggy-bank text-green-500"></i>
                Savings Rate
              </span>
            </InfoTooltip>
            <div className="text-right">
              <span
                className={`font-semibold ${hideValues ? "text-gray-400" : savingsRate >= 50 ? "text-green-600" : savingsRate >= 20 ? "text-blue-600" : "text-gray-900"}`}
              >
                {hideValues ? HIDDEN_VALUE : `${savingsRate.toFixed(1)}%`}
              </span>
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

        {/* Years to FI */}
        {yearsToFi !== null && yearsToFi > 0 && fiProgress < 100 && (
          <div className="flex justify-between items-center py-2 border-t border-gray-100">
            <InfoTooltip text="Estimated years until you reach your FI Number, based on current assets, savings rate, and expected returns.">
              <span className="text-gray-600 flex items-center gap-2">
                <i className="fas fa-calendar-alt text-blue-500"></i>
                Years to FI
              </span>
            </InfoTooltip>
            <span className="font-semibold text-gray-900">
              {hideValues
                ? HIDDEN_VALUE
                : yearsToFi <= 1
                  ? "< 1 year"
                  : `~${Math.round(yearsToFi)} years`}
            </span>
          </div>
        )}

        {/* Coast FIRE */}
        {coastFiNumber !== null && fiProgress < 100 && (
          <div className="py-3 border-t border-gray-100">
            <div className="flex justify-between items-center mb-2">
              <InfoTooltip text="Coast FIRE is the amount you need invested today so that compound growth alone (no more contributions) will reach your FI Number by retirement age.">
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
                Coast FI Progress ({yearsToRetirement}yr to retirement)
              </span>
              <span
                className={`font-medium ${hideValues ? "text-gray-400" : isCoastFire ? "text-purple-600" : "text-gray-600"}`}
              >
                {hideValues ? HIDDEN_VALUE : `${coastFiProgress?.toFixed(1)}%`}
              </span>
            </div>
            {isCoastFire && !hideValues && (
              <div className="mt-2 p-2 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex items-center gap-2 text-purple-700 text-sm">
                  <i className="fas fa-anchor"></i>
                  <span className="font-medium">Coast FIRE Achieved!</span>
                </div>
                <p className="text-xs text-purple-600 mt-1">
                  You could stop contributing now and still reach FI by age{" "}
                  {retirementAge} through investment growth alone.
                </p>
              </div>
            )}
          </div>
        )}

        {/* FI Achieved */}
        {fiProgress >= 100 && !hideValues && (
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
      </div>
    </div>
  )
}

/**
 * Calculate years to reach FI using future value formula with compound interest.
 * Returns null if FI is not achievable (negative savings or already at FI).
 */
function calculateYearsToFi(
  currentAssets: number,
  annualContribution: number,
  targetAmount: number,
  annualReturnRate: number,
): number | null {
  // Already at or above target
  if (currentAssets >= targetAmount) return 0

  // No savings and no growth - never reach FI
  if (annualContribution <= 0 && currentAssets <= 0) return null

  // If no growth rate, simple linear calculation
  if (annualReturnRate <= 0) {
    if (annualContribution <= 0) return null
    return (targetAmount - currentAssets) / annualContribution
  }

  // Binary search for years to reach target
  // FV = PV(1+r)^n + PMT × ((1+r)^n - 1) / r
  let low = 0
  let high = 100 // Max 100 years search
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

  // If still can't reach target in 100 years
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
  // Future value of present assets
  const fvPresent = presentValue * compoundFactor
  // Future value of contributions (annuity)
  const fvContributions =
    annualRate > 0
      ? annualContribution * ((compoundFactor - 1) / annualRate)
      : annualContribution * years

  return fvPresent + fvContributions
}
