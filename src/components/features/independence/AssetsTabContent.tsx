import React from "react"
import { useTranslation } from "next-i18next"
import { RetirementProjection } from "types/independence"
import { AllocationSlice } from "@lib/allocation/aggregateHoldings"
import { HIDDEN_VALUE, PensionProjection } from "@lib/independence/planHelpers"
import {
  DEFAULT_NON_SPENDABLE_CATEGORIES,
  FiMetrics,
} from "@components/features/independence"
import Spinner from "@components/ui/Spinner"
import { usePrivacyMode } from "@hooks/usePrivacyMode"

interface EffectivePlanValues {
  inflationRate: number
  equityReturnRate: number
  cashReturnRate: number
  equityAllocation: number
  cashAllocation: number
}

interface AssetsTabContentProps {
  projection: RetirementProjection | null
  effectivePlanValues: EffectivePlanValues | null
  categorySlices: AllocationSlice[]
  spendableCategories: string[]
  onToggleCategory: (category: string) => void
  pensionProjections: PensionProjection[]
  totalAssets: number
  liquidAssets: number
  blendedReturnRate: number
  currentAge: number | undefined
  retirementAge: number
  effectiveCurrency: string
  effectiveFxRate: number
  fireDataReady: boolean
  isCalculating: boolean
  holdingsLoaded: boolean
  usingManualAssets: boolean
  isRefreshingHoldings: boolean
  onRefreshHoldings: () => void
  excludedPensionFV: number
  includedPensionFvDifferential: number
}

export default function AssetsTabContent({
  projection,
  effectivePlanValues,
  categorySlices,
  spendableCategories,
  onToggleCategory,
  pensionProjections,
  totalAssets,
  liquidAssets,
  blendedReturnRate,
  currentAge,
  retirementAge,
  effectiveCurrency,
  effectiveFxRate,
  fireDataReady,
  isCalculating,
  holdingsLoaded,
  usingManualAssets,
  isRefreshingHoldings,
  onRefreshHoldings,
  excludedPensionFV,
  includedPensionFvDifferential,
}: AssetsTabContentProps): React.ReactElement {
  const { t } = useTranslation("common")
  const { hideValues } = usePrivacyMode()

  return (
    <div className="space-y-6">
      {/* FI Metrics */}
      {fireDataReady && projection?.fiMetrics && (
        <FiMetrics
          monthlyExpenses={projection.fiMetrics.netMonthlyExpenses}
          liquidAssets={projection.liquidAssets}
          currency={effectiveCurrency}
          workingIncomeMonthly={
            projection.planInputs?.workingIncomeMonthly ?? 0
          }
          monthlyInvestment={projection.planInputs?.monthlyContribution ?? 0}
          expectedReturnRate={blendedReturnRate}
          currentAge={currentAge}
          retirementAge={retirementAge}
          backendFiNumber={projection.fiMetrics.fiNumber}
          backendFiProgress={projection.fiMetrics.fiProgress}
          backendNetMonthlyExpenses={projection.fiMetrics.netMonthlyExpenses}
          backendCoastFiNumber={projection.fiMetrics.coastFiNumber}
          backendCoastFiProgress={projection.fiMetrics.coastFiProgress}
          backendIsCoastFire={projection.fiMetrics.isCoastFire}
          backendRealYearsToFi={projection.fiMetrics.realYearsToFi}
          backendRealReturnBelowSwr={projection.fiMetrics.realReturnBelowSwr}
          inflationRate={effectivePlanValues?.inflationRate ?? 0.025}
          equityReturnRate={effectivePlanValues?.equityReturnRate ?? 0.08}
          cashReturnRate={effectivePlanValues?.cashReturnRate ?? 0.03}
          equityAllocation={effectivePlanValues?.equityAllocation ?? 0.8}
          cashAllocation={effectivePlanValues?.cashAllocation ?? 0.2}
        />
      )}

      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {t("retire.assets.title")}
          </h2>
          {!usingManualAssets && (
            <button
              onClick={onRefreshHoldings}
              disabled={isRefreshingHoldings}
              className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
              title="Refresh holdings from portfolio"
            >
              <i
                className={`fas fa-sync-alt mr-1 ${isRefreshingHoldings ? "fa-spin" : ""}`}
              ></i>
              {isRefreshingHoldings ? "Refreshing..." : "Refresh"}
            </button>
          )}
        </div>

        {!holdingsLoaded && !usingManualAssets ? (
          <div className="text-center py-8 text-gray-500">
            <Spinner label={t("retire.assets.loadingHoldings")} size="lg" />
          </div>
        ) : categorySlices.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <i className="fas fa-folder-open text-4xl mb-3 text-gray-300"></i>
            <p>{t("retire.assets.noHoldings")}</p>
            <p className="text-sm mt-2">{t("retire.assets.noHoldings.hint")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {usingManualAssets ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-2">
                <p className="text-sm text-blue-800">
                  <i className="fas fa-info-circle mr-2"></i>
                  Using manually entered asset values from plan settings.
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                {t("retire.assets.selectCategories")}
              </p>
            )}
            <div className="space-y-2">
              {/* Show liquid/spendable asset categories */}
              {categorySlices
                .filter(
                  (slice) =>
                    !DEFAULT_NON_SPENDABLE_CATEGORIES.includes(slice.key),
                )
                .map((slice) => {
                  const isSpendable = spendableCategories.includes(slice.key)
                  return (
                    <div
                      key={slice.key}
                      className={`p-3 rounded-lg border transition-colors ${
                        isSpendable
                          ? "border-independence-200 bg-independence-50"
                          : "border-gray-200 bg-gray-50"
                      }`}
                    >
                      <label className="flex items-center justify-between cursor-pointer">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSpendable}
                            onChange={() => onToggleCategory(slice.key)}
                            className="w-4 h-4 text-independence-600 rounded focus:ring-independence-500"
                          />
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: slice.color }}
                          />
                          <span
                            className={
                              isSpendable ? "text-gray-900" : "text-gray-500"
                            }
                          >
                            {slice.label}
                          </span>
                        </div>
                        <span
                          className={`font-medium ${
                            hideValues
                              ? "text-gray-400"
                              : isSpendable
                                ? "text-gray-900"
                                : "text-gray-400"
                          }`}
                        >
                          {hideValues
                            ? HIDDEN_VALUE
                            : `${effectiveCurrency}${Math.round(slice.value * effectiveFxRate).toLocaleString()}`}
                        </span>
                      </label>
                    </div>
                  )
                })}

              {/* Show non-spendable (Property) separately */}
              {categorySlices
                .filter((slice) =>
                  DEFAULT_NON_SPENDABLE_CATEGORIES.includes(slice.key),
                )
                .map((slice) => (
                  <div
                    key={slice.key}
                    className="p-3 rounded-lg border border-amber-200 bg-amber-50"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: slice.color }}
                        />
                        <span className="text-gray-700">{slice.label}</span>
                        <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded">
                          Non-spendable
                        </span>
                      </div>
                      <span className="font-medium text-gray-500">
                        {hideValues
                          ? HIDDEN_VALUE
                          : `${effectiveCurrency}${Math.round(slice.value * effectiveFxRate).toLocaleString()}`}
                      </span>
                    </div>
                  </div>
                ))}
            </div>

            {/* Pension/Policy FV Projections */}
            {pensionProjections.length > 0 && (
              <div className="mt-4 border-t pt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  <i className="fas fa-chart-line mr-2 text-purple-500"></i>
                  Pension & Policy Projections
                </h3>
                <div className="space-y-2">
                  {pensionProjections.map((proj) => (
                    <div
                      key={proj.assetId}
                      className="p-3 rounded-lg border border-purple-200 bg-purple-50"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-gray-800">
                            {proj.assetName}
                          </div>
                          <div className="text-xs text-purple-600 mt-1">
                            {proj.cpfLifePlan
                              ? `CPF LIFE (${proj.cpfLifePlan.charAt(0) + proj.cpfLifePlan.slice(1).toLowerCase()}) from age ${proj.payoutAge}`
                              : `Payout at age ${proj.payoutAge}`}
                          </div>
                          {proj.monthlyPayout != null &&
                            proj.monthlyPayout > 0 && (
                              <div className="text-xs text-green-600 mt-0.5">
                                {hideValues
                                  ? HIDDEN_VALUE
                                  : `${effectiveCurrency}${Math.round(proj.monthlyPayout * effectiveFxRate).toLocaleString()}/month`}
                              </div>
                            )}
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500">Current</div>
                          <div
                            className={`text-sm ${hideValues ? "text-gray-400" : "text-gray-600"}`}
                          >
                            {hideValues
                              ? HIDDEN_VALUE
                              : `${effectiveCurrency}${Math.round(proj.currentValue * effectiveFxRate).toLocaleString()}`}
                          </div>
                          <div className="text-xs text-purple-600 mt-2">
                            Projected
                          </div>
                          <div
                            className={`font-medium ${hideValues ? "text-gray-400" : "text-purple-700"}`}
                          >
                            {hideValues
                              ? HIDDEN_VALUE
                              : `${effectiveCurrency}${Math.round(proj.projectedValue * effectiveFxRate).toLocaleString()}`}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Summary totals */}
            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">
                  {t("retire.assets.totalAssets")}
                </span>
                <span
                  className={`font-medium ${hideValues ? "text-gray-400" : ""}`}
                >
                  {hideValues
                    ? HIDDEN_VALUE
                    : `${effectiveCurrency}${Math.round(totalAssets * effectiveFxRate).toLocaleString()}`}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">
                  {t("retire.assets.spendable")}
                </span>
                <span
                  className={`font-medium ${hideValues ? "text-gray-400" : "text-independence-600"}`}
                >
                  {hideValues
                    ? HIDDEN_VALUE
                    : `${effectiveCurrency}${Math.round(liquidAssets * effectiveFxRate).toLocaleString()}`}
                </span>
              </div>
              {totalAssets > liquidAssets && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">
                      {t("retire.assets.nonSpendable")}
                    </span>
                    <span className="font-medium text-gray-400">
                      {hideValues
                        ? HIDDEN_VALUE
                        : `${effectiveCurrency}${Math.round((totalAssets - liquidAssets) * effectiveFxRate).toLocaleString()}`}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    FI uses spendable assets; illiquid assets add long-term
                    security.
                  </p>
                </>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Blended Return Rate</span>
                <span className="font-medium text-blue-600">
                  {(blendedReturnRate * 100).toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex justify-between font-medium text-lg">
                <span>
                  {t("retire.assets.spendableAtRetirement")}
                  {currentAge !== undefined && retirementAge && (
                    <span className="font-normal text-sm text-gray-500">
                      {" "}
                      (age {retirementAge},{" "}
                      {retirementAge - currentAge > 0
                        ? `${retirementAge - currentAge}yr`
                        : "now"}
                      )
                    </span>
                  )}
                </span>
                <span
                  className={
                    hideValues ? "text-gray-400" : "text-independence-600"
                  }
                >
                  {hideValues
                    ? HIDDEN_VALUE
                    : `${effectiveCurrency}${Math.round(
                        projection?.preRetirementAccumulation
                          ?.liquidAssetsAtRetirement
                          ? projection.preRetirementAccumulation
                              .liquidAssetsAtRetirement -
                              excludedPensionFV * effectiveFxRate
                          : (liquidAssets + includedPensionFvDifferential) *
                              effectiveFxRate,
                      ).toLocaleString()}`}
                </span>
              </div>
            </div>

            {isCalculating && (
              <div className="mt-4 text-center text-gray-500">
                <Spinner label={t("retire.assets.calculating")} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
