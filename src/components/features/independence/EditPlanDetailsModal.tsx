import React, { useState, useMemo } from "react"
import useSwr from "swr"
import { RetirementPlan } from "types/independence"
import { Portfolio } from "types/beancounter"

/**
 * Subset of the saved-plan fields the EditPlanDetailsModal emits via onApply.
 * The page maps these into the unified ScenarioState before they reach the
 * projection hooks. Kept local because the modal's surface is narrower than
 * the now-deleted ScenarioOverrides type.
 */
interface EditedOverrides {
  pensionMonthly?: number
  socialSecurityMonthly?: number
  benefitsStartAge?: number
  otherIncomeMonthly?: number
  monthlyExpenses?: number
  equityReturnRate?: number
  cashReturnRate?: number
  housingReturnRate?: number
  equityAllocation?: number
  cashAllocation?: number
  housingAllocation?: number
  inflationRate?: number
  targetBalance?: number
  excludedPortfolioIds?: string[]
  excludedRentalAssetIds?: string[]
}
import {
  parseExcludedPortfolioIds,
  parseExcludedRentalAssetIds,
  normalizeAllocation,
} from "@lib/independence/planHelpers"
import MathInput from "@components/ui/MathInput"
import { usePrivacyMode } from "@hooks/usePrivacyMode"
import { usePrivateAssetConfigs } from "@utils/assets/usePrivateAssetConfigs"
import { useExcludedAssetIds } from "@hooks/useExcludedAssetIds"
import { portfoliosKey, simpleFetcher } from "@utils/api/fetchHelper"

const HIDDEN_VALUE = "****"

interface EditFormData {
  pensionMonthly: number
  socialSecurityMonthly: number
  benefitsStartAge: number | undefined
  otherIncomeMonthly: number
  monthlyExpenses: number
  equityReturnRate: number
  cashReturnRate: number
  housingReturnRate: number
  equityAllocation: number
  cashAllocation: number
  housingAllocation: number
  inflationRate: number
  targetBalance: number
  excludedPortfolioIds: string[]
  excludedRentalAssetIds: string[]
}

interface EditPlanDetailsModalProps {
  onClose: () => void
  onApply: (overrides: EditedOverrides) => void
  plan: RetirementPlan
}

/**
 * Privacy-aware money input that masks the display value but allows editing
 */
function PrivacyMoneyInput({
  value,
  onChange,
  hideValues,
  min = 0,
  step = 100,
  placeholder,
}: {
  value: number
  onChange: (value: number) => void
  hideValues: boolean
  min?: number
  step?: number
  placeholder?: string
}): React.ReactElement {
  const [isFocused, setIsFocused] = useState(false)

  // When privacy mode is on and not focused, show masked value
  const displayValue = hideValues && !isFocused ? "" : value

  return (
    <div className="relative">
      <span className="absolute left-3 top-2.5 text-gray-500">$</span>
      {hideValues && !isFocused && (
        <div className="absolute inset-0 flex items-center pl-8 text-gray-400 pointer-events-none">
          {HIDDEN_VALUE}
        </div>
      )}
      <input
        type="number"
        value={displayValue}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className={`w-full pl-8 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500 ${
          hideValues && !isFocused ? "text-transparent" : ""
        }`}
        min={min}
        step={step}
        placeholder={placeholder}
      />
    </div>
  )
}

export default function EditPlanDetailsModal({
  onClose,
  onApply,
  plan,
}: EditPlanDetailsModalProps): React.ReactElement | null {
  const { hideValues } = usePrivacyMode()
  const { data: portfolioData } = useSwr(
    portfoliosKey,
    simpleFetcher(portfoliosKey),
  )
  const portfolios: Portfolio[] = portfolioData?.data || []

  // Component is conditionally mounted by the parent, so initial state can
  // be derived directly from `plan`. Parent uses a `key` tied to plan version
  // to remount when the plan changes while the modal is already open.
  const [formData, setFormData] = useState<EditFormData>(() => ({
    pensionMonthly: plan.pensionMonthly,
    socialSecurityMonthly: plan.socialSecurityMonthly,
    benefitsStartAge: plan.benefitsStartAge,
    otherIncomeMonthly: plan.otherIncomeMonthly ?? 0,
    monthlyExpenses: plan.monthlyExpenses,
    equityReturnRate: plan.equityReturnRate * 100,
    cashReturnRate: plan.cashReturnRate * 100,
    housingReturnRate: plan.housingReturnRate * 100,
    equityAllocation: plan.equityAllocation * 100,
    cashAllocation: plan.cashAllocation * 100,
    housingAllocation: plan.housingAllocation * 100,
    inflationRate: plan.inflationRate * 100,
    targetBalance: plan.targetBalance ?? 0,
    excludedPortfolioIds: parseExcludedPortfolioIds(plan.excludedPortfolioIds),
    excludedRentalAssetIds: parseExcludedRentalAssetIds(
      plan.excludedRentalAssetIds,
    ),
  }))

  const [isSyncingAllocation, setIsSyncingAllocation] = useState(false)

  const syncAllocationFromPortfolios = (): void => {
    const includedIds = portfolios
      .filter((p) => p.active !== false)
      .filter((p) => !formData.excludedPortfolioIds.includes(p.id))
      .map((p) => p.id)
    if (includedIds.length === 0) return

    setIsSyncingAllocation(true)
    fetch(
      `/api/holdings/allocation?asAt=today&ids=${encodeURIComponent(includedIds.join(","))}`,
    )
      .then((res) => res.json())
      .then((response) => {
        const d = response?.data
        if (!d) return
        const total =
          d.cashAllocation + d.equityAllocation + d.housingAllocation
        if (total > 0) {
          const norm = normalizeAllocation(
            d.equityAllocation,
            d.cashAllocation,
            d.housingAllocation,
          )
          setFormData((prev) => ({
            ...prev,
            equityAllocation: norm.equity,
            cashAllocation: norm.cash,
            housingAllocation: norm.housing,
          }))
        }
      })
      .catch(console.error)
      .finally(() => setIsSyncingAllocation(false))
  }

  // Fetch rental property configs for per-property checkboxes
  const { configs: assetConfigs, assetNames } = usePrivateAssetConfigs()
  const excludedAssetIds = useExcludedAssetIds(
    formData.excludedPortfolioIds,
    portfolios,
  )

  const rentalProperties = useMemo(() => {
    if (!assetConfigs || assetConfigs.length === 0) return []
    return assetConfigs.filter(
      (c) =>
        !c.isPrimaryResidence &&
        c.monthlyRentalIncome > 0 &&
        !excludedAssetIds.has(c.assetId),
    )
  }, [assetConfigs, excludedAssetIds])

  const handleApply = (): void => {
    onApply({
      pensionMonthly: formData.pensionMonthly,
      socialSecurityMonthly: formData.socialSecurityMonthly,
      benefitsStartAge: formData.benefitsStartAge,
      otherIncomeMonthly: formData.otherIncomeMonthly,
      monthlyExpenses: formData.monthlyExpenses,
      equityReturnRate: formData.equityReturnRate / 100,
      cashReturnRate: formData.cashReturnRate / 100,
      housingReturnRate: formData.housingReturnRate / 100,
      equityAllocation: formData.equityAllocation / 100,
      cashAllocation: formData.cashAllocation / 100,
      housingAllocation: formData.housingAllocation / 100,
      inflationRate: formData.inflationRate / 100,
      targetBalance: formData.targetBalance || undefined,
      excludedPortfolioIds: formData.excludedPortfolioIds,
      excludedRentalAssetIds: formData.excludedRentalAssetIds,
    })
    onClose()
  }

  const netMonthlyNeed =
    formData.monthlyExpenses -
    formData.pensionMonthly -
    formData.socialSecurityMonthly -
    formData.otherIncomeMonthly

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Edit Plan Details
        </h2>

        <div className="space-y-4">
          {/* Pension */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pension (Monthly)
            </label>
            <PrivacyMoneyInput
              value={formData.pensionMonthly}
              onChange={(value) =>
                setFormData((prev) => ({ ...prev, pensionMonthly: value }))
              }
              hideValues={hideValues}
            />
          </div>

          {/* Government Benefits */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Government Benefits (Monthly)
              </label>
              <PrivacyMoneyInput
                value={formData.socialSecurityMonthly}
                onChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    socialSecurityMonthly: value,
                  }))
                }
                hideValues={hideValues}
              />
            </div>
            <div className="w-24">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Age
              </label>
              <MathInput
                value={formData.benefitsStartAge ?? 0}
                onChange={(v) =>
                  setFormData((prev) => ({
                    ...prev,
                    benefitsStartAge: v ? Math.round(v) : undefined,
                  }))
                }
                placeholder="e.g. 65"
                min={50}
                max={100}
                className="w-full px-2 py-2 border rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
              />
            </div>
          </div>

          {/* Other Income */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Other Income (Monthly)
            </label>
            <PrivacyMoneyInput
              value={formData.otherIncomeMonthly}
              onChange={(value) =>
                setFormData((prev) => ({ ...prev, otherIncomeMonthly: value }))
              }
              hideValues={hideValues}
            />
          </div>

          {/* Monthly Expenses */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monthly Expenses
            </label>
            <PrivacyMoneyInput
              value={formData.monthlyExpenses}
              onChange={(value) =>
                setFormData((prev) => ({ ...prev, monthlyExpenses: value }))
              }
              hideValues={hideValues}
            />
          </div>

          {/* Return Rates */}
          <div className="border-t pt-4 mt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Return Rates
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Equity
                </label>
                <div className="relative">
                  <MathInput
                    value={formData.equityReturnRate}
                    onChange={(v) =>
                      setFormData((prev) => ({ ...prev, equityReturnRate: v }))
                    }
                    className="w-full pl-2 pr-6 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
                    min={0}
                    max={30}
                    step={0.5}
                  />
                  <span className="absolute right-2 top-2.5 text-xs text-gray-500">
                    %
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Cash</label>
                <div className="relative">
                  <MathInput
                    value={formData.cashReturnRate}
                    onChange={(v) =>
                      setFormData((prev) => ({ ...prev, cashReturnRate: v }))
                    }
                    className="w-full pl-2 pr-6 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
                    min={0}
                    max={20}
                    step={0.5}
                  />
                  <span className="absolute right-2 top-2.5 text-xs text-gray-500">
                    %
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Housing
                </label>
                <div className="relative">
                  <MathInput
                    value={formData.housingReturnRate}
                    onChange={(v) =>
                      setFormData((prev) => ({ ...prev, housingReturnRate: v }))
                    }
                    className="w-full pl-2 pr-6 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
                    min={0}
                    max={20}
                    step={0.5}
                  />
                  <span className="absolute right-2 top-2.5 text-xs text-gray-500">
                    %
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Asset Allocations */}
          <div className="border-t pt-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700">
                Asset Allocations
              </h3>
              {portfolios.filter((p) => p.active !== false).length > 0 && (
                <button
                  type="button"
                  onClick={syncAllocationFromPortfolios}
                  disabled={isSyncingAllocation}
                  className="flex items-center px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 disabled:opacity-50"
                >
                  <i className="fas fa-sync-alt mr-1"></i>
                  {isSyncingAllocation ? "Loading…" : "Use Actual"}
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Equity
                </label>
                <div className="relative">
                  <MathInput
                    value={formData.equityAllocation}
                    onChange={(v) =>
                      setFormData((prev) => ({ ...prev, equityAllocation: v }))
                    }
                    className="w-full pl-2 pr-6 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
                    min={0}
                    max={100}
                    step={5}
                  />
                  <span className="absolute right-2 top-2.5 text-xs text-gray-500">
                    %
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Cash</label>
                <div className="relative">
                  <MathInput
                    value={formData.cashAllocation}
                    onChange={(v) =>
                      setFormData((prev) => ({ ...prev, cashAllocation: v }))
                    }
                    className="w-full pl-2 pr-6 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
                    min={0}
                    max={100}
                    step={5}
                  />
                  <span className="absolute right-2 top-2.5 text-xs text-gray-500">
                    %
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Housing
                </label>
                <div className="relative">
                  <MathInput
                    value={formData.housingAllocation}
                    onChange={(v) =>
                      setFormData((prev) => ({ ...prev, housingAllocation: v }))
                    }
                    className="w-full pl-2 pr-6 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
                    min={0}
                    max={100}
                    step={5}
                  />
                  <span className="absolute right-2 top-2.5 text-xs text-gray-500">
                    %
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Total:{" "}
              {formData.equityAllocation +
                formData.cashAllocation +
                formData.housingAllocation}
              % (should equal 100%)
            </p>
          </div>

          {/* Inflation Rate */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Inflation Rate (%)
            </label>
            <div className="relative">
              <MathInput
                value={formData.inflationRate}
                onChange={(v) =>
                  setFormData((prev) => ({ ...prev, inflationRate: v }))
                }
                className="w-full pl-4 pr-8 py-2 border rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
                min={0}
                max={20}
                step={0.1}
              />
              <span className="absolute right-3 top-2.5 text-gray-500">%</span>
            </div>
          </div>

          {/* Target Balance */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Balance (Optional)
            </label>
            <PrivacyMoneyInput
              value={formData.targetBalance}
              onChange={(value) =>
                setFormData((prev) => ({ ...prev, targetBalance: value }))
              }
              hideValues={hideValues}
              step={10000}
            />
            <p className="text-xs text-gray-500 mt-1">
              Minimum balance to maintain at end of life
            </p>
          </div>

          {/* Portfolios — selection is account-wide; editing moved to Net Worth tab */}
          <div className="border-t pt-4 mt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Portfolios
            </h3>
            <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <i className="fas fa-info-circle text-blue-500 mt-0.5 flex-shrink-0 text-sm"></i>
              <p className="text-xs text-blue-800">
                Portfolio selection is set account-wide on the{" "}
                <span className="font-medium">Net Worth tab</span> on the
                Independence page. Open Independence &#8594; Net Worth to change
                which portfolios count.
              </p>
            </div>
          </div>

          {/* Per-property Rental Income */}
          {rentalProperties.length > 0 && (
            <div className="border-t pt-4 mt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Rental Income
              </h3>
              <p className="text-xs text-gray-500 mb-2">
                Uncheck to exclude a property from projections
              </p>
              <div className="space-y-1">
                {rentalProperties.map((config) => {
                  const isExcluded = formData.excludedRentalAssetIds.includes(
                    config.assetId,
                  )
                  const percentFee =
                    config.monthlyRentalIncome * config.managementFeePercent
                  const effectiveMgmtFee = Math.max(
                    config.monthlyManagementFee,
                    percentFee,
                  )
                  const monthlyPropertyTax =
                    (config.annualPropertyTax || 0) / 12
                  const monthlyInsurance = (config.annualInsurance || 0) / 12
                  const totalExpenses =
                    effectiveMgmtFee +
                    (config.monthlyBodyCorporateFee || 0) +
                    monthlyPropertyTax +
                    monthlyInsurance +
                    (config.monthlyOtherExpenses || 0)
                  const netIncome = Math.max(
                    0,
                    config.monthlyRentalIncome - totalExpenses,
                  )
                  return (
                    <label
                      key={config.assetId}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                        isExcluded
                          ? "bg-gray-50 text-gray-400"
                          : "hover:bg-green-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!isExcluded}
                          onChange={() => {
                            setFormData((prev) => ({
                              ...prev,
                              excludedRentalAssetIds: isExcluded
                                ? prev.excludedRentalAssetIds.filter(
                                    (id) => id !== config.assetId,
                                  )
                                : [
                                    ...prev.excludedRentalAssetIds,
                                    config.assetId,
                                  ],
                            }))
                          }}
                          className="w-4 h-4 text-green-500 rounded border-gray-300"
                        />
                        <span
                          className={`text-sm ${isExcluded ? "line-through" : "text-gray-700"}`}
                        >
                          {assetNames[config.assetId] || config.assetId}
                        </span>
                      </div>
                      <span
                        className={`text-sm font-medium ${isExcluded ? "line-through" : "text-green-600"}`}
                      >
                        {config.rentalCurrency}{" "}
                        {netIncome.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {/* Net Monthly Need Preview */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Net Monthly Need</span>
              <span
                className={`font-medium ${hideValues ? "text-gray-400" : "text-independence-600"}`}
              >
                {hideValues
                  ? HIDDEN_VALUE
                  : `$${netMonthlyNeed.toLocaleString()}`}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="flex-1 py-2 px-4 bg-independence-500 text-white rounded-lg font-medium hover:bg-independence-600 transition-colors"
          >
            <i className="fas fa-check mr-2"></i>
            Apply
          </button>
        </div>
        <p className="text-xs text-gray-500 text-center mt-2">
          Changes will update the projection. Use Save to persist.
        </p>
      </div>
    </div>
  )
}
