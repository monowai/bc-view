import React from "react"
import { calculateSavingsRate } from "@utils/independence/fiCalculations"

export interface FiAgeExplorerProps {
  liquidAssets: number
  fiNumber: number
  currentAge: number
  monthlyInvestment: number
  workingIncomeMonthly: number
  realReturnRate: number
  currency: string
}

/**
 * Calculate required monthly investment to hit FI at a target age.
 * Uses compound growth formula: FV = PV(1+r)^n + PMT × ((1+r)^n - 1) / r
 * Solving for PMT: PMT = (FV - PV(1+r)^n) × r / ((1+r)^n - 1)
 */
function calculateRequiredMonthly(
  liquidAssets: number,
  fiNumber: number,
  targetYears: number,
  realReturnRate: number,
): number | null {
  if (targetYears <= 0) return null
  if (liquidAssets >= fiNumber) return 0

  const r = realReturnRate
  if (r <= 0) {
    // No growth - simple division
    return (fiNumber - liquidAssets) / targetYears / 12
  }

  const compoundFactor = Math.pow(1 + r, targetYears)
  const futureValueOfCurrent = liquidAssets * compoundFactor

  if (futureValueOfCurrent >= fiNumber) {
    return 0 // Current assets will grow to meet FI number
  }

  const annualRequired =
    ((fiNumber - futureValueOfCurrent) * r) / (compoundFactor - 1)

  return annualRequired / 12
}

/**
 * Explores required savings rate to hit FI at different target ages.
 * Collapsible component that allows users to explore "what if I want to retire at age X?"
 */
export default function FiAgeExplorer({
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
    calculateSavingsRate(monthlyInvestment, workingIncomeMonthly) ?? 0

  const yearsToTarget = targetAge - currentAge
  const requiredMonthly = calculateRequiredMonthly(
    liquidAssets,
    fiNumber,
    yearsToTarget,
    realReturnRate,
  )
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
              min={currentAge}
              max={Math.max(currentAge + 40, 65)}
              value={targetAge}
              onChange={(e) => setTargetAge(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>{currentAge}</span>
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
