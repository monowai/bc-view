import React from "react"
import { DisplayProjection, WhatIfAdjustments } from "./types"
import { usePrivacyMode } from "@hooks/usePrivacyMode"

const HIDDEN_VALUE = "****"

interface ScenarioImpactProps {
  projection: DisplayProjection | null
  lifeExpectancy: number
  currency: string
  fxRate?: number
  whatIfAdjustments: WhatIfAdjustments
  onLiquidationThresholdChange: (value: number) => void
}

export default function ScenarioImpact({
  projection,
  lifeExpectancy,
  currency,
  fxRate = 1,
  whatIfAdjustments,
  onLiquidationThresholdChange,
}: ScenarioImpactProps): React.ReactElement {
  const { hideValues } = usePrivacyMode()

  const formatMoney = (value: number): string =>
    hideValues
      ? HIDDEN_VALUE
      : `${currency}${Math.round(value * fxRate).toLocaleString()}`

  if (!projection) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Scenario Impact
        </h2>
        <div className="text-center py-8 text-gray-500">
          <i className="fas fa-calculator text-4xl mb-3 text-gray-300"></i>
          <p>Calculate a projection first</p>
        </div>
      </div>
    )
  }

  const liquidationYear = projection.yearlyProjections.find(
    (y) => y.propertyLiquidated,
  )

  const hasIlliquidAssets =
    projection.yearlyProjections[0]?.nonSpendableValue > 0

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Scenario Impact
      </h2>

      <div className="space-y-3">
        {/* Liquid funds last to */}
        <div className="flex justify-between items-center py-2 border-b border-gray-100">
          <span className="text-gray-600">
            <i className="fas fa-coins text-blue-500 mr-2"></i>
            Liquid funds last to
          </span>
          <span className="font-semibold text-gray-900">
            {liquidationYear
              ? `Age ${liquidationYear.age}`
              : `Beyond ${lifeExpectancy}`}
          </span>
        </div>

        {/* Illiquid funds section */}
        {hasIlliquidAssets && (
          <>
            {/* Liquid balance at liquidation */}
            {projection.liquidBalanceAtLiquidation !== undefined && (
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-600">
                  <i className="fas fa-piggy-bank text-orange-500 mr-2"></i>
                  Liquid balance at sale
                </span>
                <span className={`font-semibold ${hideValues ? "text-gray-400" : "text-gray-900"}`}>
                  {formatMoney(projection.liquidBalanceAtLiquidation)}
                </span>
              </div>
            )}

            {/* Illiquid funds realise value */}
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-600">
                <i className="fas fa-home text-purple-500 mr-2"></i>
                Illiquid funds realise
              </span>
              <span className={`font-semibold ${hideValues ? "text-gray-400" : "text-gray-900"}`}>
                {(() => {
                  if (liquidationYear) {
                    const idx =
                      projection.yearlyProjections.indexOf(liquidationYear)
                    const prevYear = projection.yearlyProjections[idx - 1]
                    const realizedValue =
                      prevYear?.nonSpendableValue ||
                      projection.yearlyProjections[0]?.nonSpendableValue ||
                      0
                    return formatMoney(realizedValue)
                  }
                  // Not liquidated - show projected final value
                  const finalYear =
                    projection.yearlyProjections[
                      projection.yearlyProjections.length - 1
                    ]
                  return formatMoney(finalYear?.nonSpendableValue || 0)
                })()}
              </span>
            </div>

            {/* Total wealth lasts to */}
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-600">
                <i className="fas fa-chart-line text-green-500 mr-2"></i>
                Total wealth lasts to
              </span>
              <span className="font-semibold text-gray-900">
                {(() => {
                  const depletionYear = projection.yearlyProjections.find(
                    (y) => y.totalWealth <= 0,
                  )
                  return depletionYear
                    ? `Age ${depletionYear.age}`
                    : `Beyond ${lifeExpectancy}`
                })()}
              </span>
            </div>

            {/* Liquidation threshold slider */}
            <div className="pt-3 border-t border-gray-100">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">
                  Sell trigger threshold
                </span>
                <span className="text-sm font-medium text-gray-900">
                  {whatIfAdjustments.liquidationThreshold}%
                </span>
              </div>
              <input
                type="range"
                min={5}
                max={50}
                step={5}
                value={whatIfAdjustments.liquidationThreshold}
                onChange={(e) =>
                  onLiquidationThresholdChange(parseInt(e.target.value))
                }
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Sell illiquid assets when liquid drops below this % of initial
              </p>
            </div>
          </>
        )}

        {/* Property sale notice */}
        {liquidationYear && (
          <div className="mt-2 text-xs text-gray-500 italic">
            Property sold at age {liquidationYear.age} when liquid assets
            dropped below {whatIfAdjustments.liquidationThreshold}%
          </div>
        )}
      </div>
    </div>
  )
}
