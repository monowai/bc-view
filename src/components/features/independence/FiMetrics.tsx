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
  /** Pre-calculated FI Number from backend (overrides local calculation) */
  backendFiNumber?: number
  /** Pre-calculated FI Progress from backend (overrides local calculation) */
  backendFiProgress?: number
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

interface FiAgeExplorerProps {
  liquidAssets: number
  fiNumber: number
  currentAge: number
  monthlyInvestment: number
  workingIncomeMonthly: number
  realReturnRate: number
  currency: string
}

/**
 * Explores required savings rate to hit FI at different target ages
 */
function FiAgeExplorer({
  liquidAssets,
  fiNumber,
  currentAge,
  monthlyInvestment,
  workingIncomeMonthly,
  realReturnRate,
  currency,
}: FiAgeExplorerProps): React.ReactElement {
  const [isExpanded, setIsExpanded] = React.useState(false)
  const [targetAge, setTargetAge] = React.useState(currentAge + 20)

  // Current savings rate
  const currentSavingsRate =
    workingIncomeMonthly > 0
      ? (monthlyInvestment / workingIncomeMonthly) * 100
      : 0

  // Calculate required monthly investment to hit FI at target age
  const calculateRequiredMonthly = (targetYears: number): number | null => {
    if (targetYears <= 0) return null
    if (liquidAssets >= fiNumber) return 0

    // Inflate FI number to target year (need more in nominal terms)
    const inflatedFiNumber = fiNumber // Already in today's dollars, using real returns

    // FV = PV(1+r)^n + PMT × ((1+r)^n - 1) / r
    // Solving for PMT (annual):
    // PMT = (FV - PV(1+r)^n) × r / ((1+r)^n - 1)
    const r = realReturnRate
    if (r <= 0) {
      // No growth - simple division
      return (inflatedFiNumber - liquidAssets) / targetYears / 12
    }

    const compoundFactor = Math.pow(1 + r, targetYears)
    const futureValueOfCurrent = liquidAssets * compoundFactor

    if (futureValueOfCurrent >= inflatedFiNumber) {
      return 0 // Current assets will grow to meet FI number
    }

    const annualRequired =
      ((inflatedFiNumber - futureValueOfCurrent) * r) / (compoundFactor - 1)

    return annualRequired / 12
  }

  const yearsToTarget = targetAge - currentAge
  const requiredMonthly = calculateRequiredMonthly(yearsToTarget)
  const requiredSavingsRate =
    requiredMonthly !== null && workingIncomeMonthly > 0
      ? (requiredMonthly / workingIncomeMonthly) * 100
      : null

  // Generate age options for quick selection
  const ageOptions = [
    { age: 40, label: "40" },
    { age: 45, label: "45" },
    { age: 50, label: "50" },
    { age: 55, label: "55" },
    { age: 60, label: "60" },
  ].filter((opt) => opt.age > currentAge)

  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left"
      >
        <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <i className="fas fa-bullseye text-indigo-500"></i>
          Target FI Age
        </span>
        <i
          className={`fas fa-chevron-${isExpanded ? "up" : "down"} text-gray-400`}
        ></i>
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-4">
          <p className="text-xs text-gray-500">
            How much would you need to save to reach FI by a specific age?
          </p>

          {/* Quick age buttons */}
          <div className="flex gap-2 flex-wrap">
            {ageOptions.map((opt) => (
              <button
                key={opt.age}
                onClick={() => setTargetAge(opt.age)}
                className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                  targetAge === opt.age
                    ? "bg-indigo-100 border-indigo-300 text-indigo-700"
                    : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                }`}
              >
                Age {opt.label}
              </button>
            ))}
          </div>

          {/* Custom age slider */}
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Target Age</span>
              <span className="font-medium text-gray-700">{targetAge}</span>
            </div>
            <input
              type="range"
              min={currentAge + 5}
              max={Math.max(currentAge + 40, 65)}
              value={targetAge}
              onChange={(e) => setTargetAge(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>{currentAge + 5}</span>
              <span>{yearsToTarget} years from now</span>
              <span>{Math.max(currentAge + 40, 65)}</span>
            </div>
          </div>

          {/* Results */}
          {requiredMonthly !== null && requiredSavingsRate !== null && (
            <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100">
              <div className="text-sm text-gray-600 mb-2">
                To reach FI by age{" "}
                <span className="font-bold">{targetAge}</span>:
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-500">Required Monthly</div>
                  <div className="text-lg font-bold text-indigo-600">
                    {currency}
                    {Math.round(requiredMonthly).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Savings Rate</div>
                  <div className="text-lg font-bold text-indigo-600">
                    {requiredSavingsRate.toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* Comparison to current */}
              <div className="mt-3 pt-3 border-t border-indigo-200">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Your current rate:</span>
                  <span className="font-medium">
                    {currentSavingsRate.toFixed(1)}%
                  </span>
                </div>
                {requiredSavingsRate > currentSavingsRate ? (
                  <div className="mt-2 text-xs">
                    <span className="text-amber-600">
                      <i className="fas fa-arrow-up mr-1"></i>
                      Need{" "}
                      {(requiredSavingsRate - currentSavingsRate).toFixed(1)}%
                      more
                    </span>
                    <span className="text-gray-500 ml-2">
                      (+{currency}
                      {Math.round(
                        requiredMonthly - monthlyInvestment,
                      ).toLocaleString()}
                      /mo)
                    </span>
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-green-600">
                    <i className="fas fa-check mr-1"></i>
                    You&apos;re already saving enough for this target!
                  </div>
                )}
              </div>
            </div>
          )}

          {requiredSavingsRate !== null && requiredSavingsRate > 100 && (
            <p className="text-xs text-amber-600">
              <i className="fas fa-exclamation-triangle mr-1"></i>
              This target requires saving more than your income. Consider a
              later target age or increasing income.
            </p>
          )}
        </div>
      )}
    </div>
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
  backendFiNumber,
  backendFiProgress,
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
  const annualExpenses = monthlyExpenses * 12
  const localFiNumber = annualExpenses * 25
  const fiNumber = backendFiNumber ?? localFiNumber

  // FI Progress = (Liquid Assets / FI Number) × 100
  // Use backend value if provided for consistency
  const localFiProgress = fiNumber > 0 ? (liquidAssets / fiNumber) * 100 : 0
  const fiProgress = backendFiProgress ?? localFiProgress
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
  // Use backend values if provided for consistency
  const yearsToRetirement =
    currentAge && retirementAge && retirementAge > currentAge
      ? retirementAge - currentAge
      : null
  const localCoastFiNumber =
    yearsToRetirement && expectedReturnRate > 0
      ? fiNumber / Math.pow(1 + expectedReturnRate, yearsToRetirement)
      : null
  const coastFiNumber = backendCoastFiNumber ?? localCoastFiNumber
  const localCoastFiProgress =
    coastFiNumber && coastFiNumber > 0
      ? (liquidAssets / coastFiNumber) * 100
      : null
  const coastFiProgress = backendCoastFiProgress ?? localCoastFiProgress
  const isCoastFire =
    backendIsCoastFire ?? (coastFiProgress !== null && coastFiProgress >= 100)

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

        {/* SWR Warning - Real return below safe withdrawal rate */}
        {backendRealReturnBelowSwr && !hideValues && fiProgress < 100 && (
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

        {/* Coast FIRE - uses years to FI achievement, not traditional retirement age */}
        {coastFiNumber !== null &&
          fiProgress < 100 &&
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

        {/* FI Age Explorer - explore required savings for different target ages */}
        {fiProgress < 100 &&
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
              realReturnRate={
                equityReturnRate * equityAllocation +
                cashReturnRate * cashAllocation -
                inflationRate
              }
              currency={currency}
            />
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
