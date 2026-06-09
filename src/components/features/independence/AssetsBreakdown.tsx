import React from "react"
import { RetirementProjection } from "types/independence"
import { AllocationSlice } from "@lib/allocation/aggregateHoldings"
import { HIDDEN_VALUE, PensionProjection } from "@lib/independence/planHelpers"
import { CpfSubAccountRow } from "@lib/independence/cpfSubAccountTags"
import {
  DEFAULT_NON_SPENDABLE_CATEGORIES,
  INCOME_STREAM_CATEGORIES,
} from "@components/features/independence"
import Spinner from "@components/ui/Spinner"
import InfoTooltip from "@components/ui/Tooltip"
import { usePrivacyMode } from "@hooks/usePrivacyMode"

interface AssetsBreakdownProps {
  projection: RetirementProjection | null
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
  isCalculating: boolean
  holdingsLoaded: boolean
  usingManualAssets: boolean
  isRefreshingHoldings: boolean
  onRefreshHoldings: () => void
  excludedPensionFV: number
  includedPensionFvDifferential: number
  /**
   * Per-sub-account display rows for CPF policies. Empty array (or undefined)
   * hides the breakdown panel — used to suppress for non-CPF plans.
   */
  cpfSubAccountRows?: CpfSubAccountRow[]
}

/**
 * Assets by Category breakdown — toggleable spendable categories, income-stream
 * (CPF/policy) read-out, non-spendable property, pension projections, and
 * summary totals. Lives next to Plan Details on the My Plan tab.
 */
export default function AssetsBreakdown({
  projection,
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
  isCalculating,
  holdingsLoaded,
  usingManualAssets,
  isRefreshingHoldings,
  onRefreshHoldings,
  excludedPensionFV,
  includedPensionFvDifferential,
  cpfSubAccountRows,
}: AssetsBreakdownProps): React.ReactElement {
  const { hideValues } = usePrivacyMode()

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          {"Assets by Category"}
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
          <Spinner label={"Loading holdings..."} size="lg" />
        </div>
      ) : categorySlices.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <i className="fas fa-folder-open text-4xl mb-3 text-gray-300"></i>
          <p>{"No holdings found"}</p>
          <p className="text-sm mt-2">
            {"Add positions to your portfolios to see asset categories."}
          </p>
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
              {
                "Select which asset categories can be spent after reaching independence:"
              }
            </p>
          )}
          <div className="space-y-2">
            {categorySlices
              .filter(
                (slice) =>
                  !DEFAULT_NON_SPENDABLE_CATEGORIES.includes(slice.key) &&
                  !INCOME_STREAM_CATEGORIES.includes(slice.key),
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

            {categorySlices
              .filter(
                (slice) =>
                  INCOME_STREAM_CATEGORIES.includes(slice.key) ||
                  DEFAULT_NON_SPENDABLE_CATEGORIES.includes(slice.key),
              )
              .map((slice) => {
                const isIncomeStream = INCOME_STREAM_CATEGORIES.includes(
                  slice.key,
                )
                return (
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
                        <span
                          className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded"
                          title={
                            isIncomeStream
                              ? "Balance pays out as a scheduled income stream (CPF LIFE annuity, policy maturity) — already counted in the Income column."
                              : undefined
                          }
                        >
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
                )
              })}
          </div>

          {cpfSubAccountRows && cpfSubAccountRows.length > 0 && (
            <div className="mt-4 border-t pt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                <i className="fas fa-layer-group mr-2 text-teal-500"></i>
                CPF Sub-Accounts
              </h3>
              <p className="text-xs text-gray-500 mb-2">
                {
                  "Liquid totals above include CPF OA + SA + RA. Each sub-account has different access rules — only OA is reachable today, and SA/RA flow into CPF LIFE at age 55."
                }
              </p>
              <div className="space-y-2">
                {cpfSubAccountRows.map((row) => {
                  const toneClasses =
                    row.tagTone === "amber"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-gray-200 text-gray-700"
                  return (
                    <div
                      key={`${row.parentAssetId}-${row.code}`}
                      className="p-3 rounded-lg border border-teal-200 bg-teal-50"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-medium text-gray-800 truncate">
                            {row.displayName}
                          </span>
                          <InfoTooltip text={row.tooltip}>
                            <span
                              className={`text-xs px-2 py-0.5 rounded ${toneClasses}`}
                            >
                              {row.tagLabel}
                            </span>
                          </InfoTooltip>
                        </div>
                        <span
                          className={`font-medium ${hideValues ? "text-gray-400" : "text-gray-800"}`}
                        >
                          {hideValues
                            ? HIDDEN_VALUE
                            : `${effectiveCurrency}${Math.round(row.balance * effectiveFxRate).toLocaleString()}`}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

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

          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{"Total Assets"}</span>
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
                {"Spendable (Liquid) Assets"}
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
                  <span className="text-gray-500">{"Non-Spendable"}</span>
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
                {"Spendable at Independence"}
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
              <Spinner label={"Calculating projection..."} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
