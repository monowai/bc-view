import React, { useEffect, useMemo, useRef } from "react"
import {
  Control,
  Controller,
  FieldErrors,
  useFieldArray,
  useWatch,
} from "react-hook-form"
import useSwr from "swr"
import { usePrivateAssetConfigs } from "@lib/assets/usePrivateAssetConfigs"
import { simpleFetcher } from "@utils/api/fetchHelper"
import { WizardFormData, ContributionFormEntry } from "types/independence"
import { Asset } from "types/beancounter"
import { wizardMessages } from "@lib/independence/messages"
import {
  StepHeader,
  CurrencyInputWithPeriod,
  PercentInput,
  SummaryBox,
  SummaryItem,
} from "../form"

const msg = wizardMessages.steps.contributions

interface AssetsResponse {
  data: Record<string, Asset>
}

interface ContributionsStepProps {
  control: Control<WizardFormData>
  errors: FieldErrors<WizardFormData>
}

export default function ContributionsStep({
  control,
  errors,
}: ContributionsStepProps): React.ReactElement {
  const { fields, replace } = useFieldArray({
    control,
    name: "contributions",
  })
  const hasInitialized = useRef(false)

  const { configs, isLoading: configsLoading } = usePrivateAssetConfigs()

  // Fetch user's assets to get names and categories
  const { data: assetsData, isLoading: assetsLoading } = useSwr<AssetsResponse>(
    "/api/assets",
    simpleFetcher("/api/assets"),
  )

  const isLoading = configsLoading || assetsLoading

  // Build asset lookup map for names and categories
  const assetLookup = useMemo(() => {
    const map = new Map<string, { name: string; category: string }>()
    if (assetsData?.data) {
      // Response is { data: Record<string, Asset> } - iterate over values
      const assets = Object.values(assetsData.data) as Asset[]
      assets.forEach((asset) => {
        map.set(asset.id, {
          name: asset.name,
          category: asset.assetCategory?.id || "OTHER",
        })
      })
    }
    return map
  }, [assetsData])

  // Filter to only pension/insurance assets
  const pensionAssets = configs.filter((c) => c.isPension)

  const watchedContributions = useWatch({ control, name: "contributions" })
  const contributions = useMemo(
    () => watchedContributions || ([] as ContributionFormEntry[]),
    [watchedContributions],
  )

  // Watch income-related fields for summary
  const workingIncomeMonthly =
    useWatch({ control, name: "workingIncomeMonthly" }) || 0
  const workingExpensesMonthly =
    useWatch({ control, name: "workingExpensesMonthly" }) || 0
  const taxesMonthly = useWatch({ control, name: "taxesMonthly" }) || 0
  const bonusMonthly = useWatch({ control, name: "bonusMonthly" }) || 0
  const investmentAllocationPercent =
    useWatch({ control, name: "investmentAllocationPercent" }) || 80

  // Initialize contributions with pension assets when data loads
  // Only initialize for NEW plans or when there are no contributions yet
  // Uses monthlyContribution from asset config as the default value (set during onboarding)
  useEffect(() => {
    if (
      pensionAssets.length > 0 &&
      !hasInitialized.current &&
      contributions.length === 0 &&
      assetLookup.size > 0
    ) {
      const initialContributions: ContributionFormEntry[] = pensionAssets.map(
        (asset) => {
          const assetInfo = assetLookup.get(asset.assetId)
          return {
            assetId: asset.assetId,
            assetName: assetInfo?.name || asset.assetId,
            // Use the monthlyContribution from asset config as default (from onboarding)
            monthlyAmount: asset.monthlyContribution || 0,
            contributionType: "PENSION" as const,
          }
        },
      )
      replace(initialContributions)
      hasInitialized.current = true
    }
  }, [pensionAssets, replace, contributions.length, assetLookup])

  // Sync contributions when pension assets change (e.g., new pension asset added)
  useEffect(() => {
    if (pensionAssets.length > 0 && hasInitialized.current) {
      const currentAssetIds = new Set(contributions.map((c) => c.assetId))
      const pensionAssetIds = new Set(pensionAssets.map((a) => a.assetId))

      // Check if we need to add new pension assets
      const newAssets = pensionAssets.filter(
        (a) => !currentAssetIds.has(a.assetId),
      )

      if (newAssets.length > 0) {
        const updatedContributions = [
          ...contributions,
          ...newAssets.map((asset) => {
            const assetInfo = assetLookup.get(asset.assetId)
            return {
              assetId: asset.assetId,
              assetName: assetInfo?.name || asset.assetId,
              // Use the monthlyContribution from asset config as default
              monthlyAmount: asset.monthlyContribution || 0,
              contributionType: "PENSION" as const,
            }
          }),
        ]
        // Filter out removed pension assets
        const filteredContributions = updatedContributions.filter((c) =>
          pensionAssetIds.has(c.assetId),
        )
        replace(filteredContributions)
      }
    }
  }, [pensionAssets, contributions, replace, assetLookup])

  // Calculate totals by category
  const { housingTotal, otherTotal, grandTotal } = useMemo(() => {
    let housing = 0
    let other = 0

    for (const contribution of contributions) {
      const amount = contribution?.monthlyAmount || 0
      const assetInfo = assetLookup.get(contribution?.assetId || "")
      const category = assetInfo?.category || "OTHER"

      // RE = Real Estate / Housing
      if (category === "RE") {
        housing += amount
      } else {
        other += amount
      }
    }

    return {
      housingTotal: housing,
      otherTotal: other,
      grandTotal: housing + other,
    }
  }, [contributions, assetLookup])

  // Income calculations for employment summary
  const netIncomeMonthly = workingIncomeMonthly + bonusMonthly - taxesMonthly
  const monthlySurplus = netIncomeMonthly - workingExpensesMonthly
  const surplusAfterContributions = monthlySurplus - grandTotal
  const monthlyInvestment = Math.max(
    0,
    surplusAfterContributions * (investmentAllocationPercent / 100),
  )

  // Summary items for display
  const summaryItems: SummaryItem[] = [
    {
      icon: "fa-money-bill-wave",
      label: "Net Income",
      value: netIncomeMonthly,
      format: "currency",
      valueClassName: "text-green-700",
    },
    {
      icon: "fa-receipt",
      label: "Working Expenses",
      value: workingExpensesMonthly,
      format: "currency",
      valueClassName: "text-gray-700",
    },
    {
      icon: "fa-piggy-bank",
      label: "Monthly Surplus",
      value: monthlySurplus,
      format: "currency",
      valueClassName: monthlySurplus >= 0 ? "text-blue-700" : "text-red-600",
    },
    ...(grandTotal > 0
      ? [
          {
            icon: "fa-hand-holding-usd",
            label: "Pension Contributions",
            value: -grandTotal,
            format: "currency" as const,
            valueClassName: "text-purple-700",
          },
          {
            icon: "fa-wallet",
            label: "Available for Investment",
            value: surplusAfterContributions,
            format: "currency" as const,
            valueClassName:
              surplusAfterContributions >= 0 ? "text-blue-700" : "text-red-600",
          },
        ]
      : []),
    {
      icon: "fa-chart-line",
      label: "Monthly Investment",
      value: monthlyInvestment,
      format: "currency",
    },
  ]

  const summaryDescription =
    surplusAfterContributions < 0
      ? "Your expenses and contributions exceed your net income. Consider adjusting your budget."
      : grandTotal > 0
        ? `After $${grandTotal.toLocaleString()} in pension contributions, you have $${surplusAfterContributions.toLocaleString()} available. Investing ${investmentAllocationPercent}% = $${monthlyInvestment.toLocaleString()}/month.`
        : `Aim to invest ${investmentAllocationPercent}% of your $${monthlySurplus.toLocaleString()} surplus each month.`

  // Get display name for an asset
  const getAssetName = (assetId: string, fallback: string): string => {
    const assetInfo = assetLookup.get(assetId)
    return assetInfo?.name || fallback
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <StepHeader
          title="Income & Contributions"
          description="Enter your current income details and pension contributions."
        />
        <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <i className="fas fa-spinner fa-spin text-4xl text-gray-400 mb-2"></i>
          <p className="text-gray-500">Loading pension assets...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <StepHeader
        title="Income & Contributions"
        description="Enter your current income details and pension contributions."
      />

      {/* Income Section */}
      <div className="space-y-4">
        <h3 className="font-medium text-gray-700">Employment Income</h3>
        <CurrencyInputWithPeriod
          name="workingIncomeMonthly"
          label="Gross Salary"
          helperText="Your salary before taxes (not including bonus)."
          control={control}
          errors={errors}
        />

        <CurrencyInputWithPeriod
          name="bonusMonthly"
          label="Bonus"
          helperText="Annual bonus, commissions, or other variable income."
          control={control}
          errors={errors}
          defaultPeriod="annual"
        />

        <CurrencyInputWithPeriod
          name="taxesMonthly"
          label="Taxes"
          helperText="Income tax, social contributions, and other deductions."
          control={control}
          errors={errors}
        />

        <PercentInput
          name="investmentAllocationPercent"
          label="Investment Allocation"
          helperText="Percentage of your monthly surplus to invest for independence."
          control={control}
          errors={errors}
          step={5}
        />
      </div>

      {/* Pension Contributions Section */}
      {pensionAssets.length > 0 && (
        <>
          <div className="border-t border-gray-200 pt-6">
            <h3 className="font-medium text-gray-700 mb-4">
              Pension Contributions
            </h3>
            <p className="text-sm text-gray-600 mb-4">{msg.description}</p>
          </div>

          <div className="space-y-3">
            {fields.map((field, index) => {
              const pensionAsset = pensionAssets.find(
                (a) => a.assetId === field.assetId,
              )
              const displayName = getAssetName(
                field.assetId,
                contributions[index]?.assetName || field.assetId,
              )
              const assetInfo = assetLookup.get(field.assetId)
              const isHousing = assetInfo?.category === "RE"

              return (
                <div
                  key={field.id}
                  className={`p-4 rounded-lg border ${
                    isHousing
                      ? "bg-amber-50 border-amber-200"
                      : "bg-purple-50 border-purple-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <i
                          className={`fas ${isHousing ? "fa-home text-amber-600" : "fa-piggy-bank text-purple-600"} mr-3`}
                        ></i>
                        <span className="font-medium text-gray-900">
                          {displayName}
                        </span>
                        <span
                          className={`ml-2 text-xs px-2 py-0.5 rounded ${
                            isHousing
                              ? "bg-amber-100 text-amber-700"
                              : "bg-purple-100 text-purple-700"
                          }`}
                        >
                          {isHousing ? "Housing" : "Pension"}
                        </span>
                      </div>
                      {pensionAsset?.payoutAge && (
                        <p className="text-sm text-gray-500 mt-1 ml-8">
                          Payout at age {Math.round(pensionAsset.payoutAge)}
                          {pensionAsset.monthlyPayoutAmount &&
                            ` - $${Math.round(pensionAsset.monthlyPayoutAmount).toLocaleString()}/month`}
                        </p>
                      )}
                    </div>

                    <div className="w-40">
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-gray-500">
                          $
                        </span>
                        <Controller
                          name={`contributions.${index}.monthlyAmount`}
                          control={control}
                          render={({ field: inputField }) => (
                            <input
                              {...inputField}
                              type="number"
                              min={0}
                              step={50}
                              onChange={(e) =>
                                inputField.onChange(Number(e.target.value) || 0)
                              }
                              placeholder="0"
                              className={`
                                w-full pl-8 pr-4 py-2 border rounded-lg focus:ring-2 text-right
                                ${isHousing ? "focus:ring-amber-500 focus:border-amber-500" : "focus:ring-purple-500 focus:border-purple-500"}
                                ${errors.contributions?.[index]?.monthlyAmount ? "border-red-500" : "border-gray-300"}
                              `}
                            />
                          )}
                        />
                      </div>
                      <p className="text-xs text-gray-500 text-right mt-1">
                        /month
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}

            {errors.contributions && !Array.isArray(errors.contributions) && (
              <p className="text-sm text-red-600">
                {errors.contributions.message}
              </p>
            )}
          </div>

          {/* Breakdown by category */}
          {grandTotal > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
              <h3 className="font-medium text-gray-700 mb-2">
                Contribution Breakdown
              </h3>

              {housingTotal > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center">
                    <i className="fas fa-home text-amber-600 mr-2 w-4"></i>
                    <span className="text-gray-600">Housing</span>
                  </div>
                  <span className="font-medium text-amber-700">
                    ${housingTotal.toLocaleString()}
                  </span>
                </div>
              )}

              {otherTotal > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center">
                    <i className="fas fa-piggy-bank text-purple-600 mr-2 w-4"></i>
                    <span className="text-gray-600">Pension & Other</span>
                  </div>
                  <span className="font-medium text-purple-700">
                    ${otherTotal.toLocaleString()}
                  </span>
                </div>
              )}

              <div className="border-t border-gray-300 pt-3 mt-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <i className="fas fa-calculator text-gray-600 mr-2 w-4"></i>
                    <span className="font-medium text-gray-800">
                      {msg.totalLabel}
                    </span>
                  </div>
                  <span className="text-xl font-bold text-gray-900">
                    ${grandTotal.toLocaleString()}
                  </span>
                </div>
              </div>

              <p className="text-sm text-gray-500 mt-2">
                This amount will be deducted from your disposable income and
                credited to your pension assets.
              </p>
            </div>
          )}
        </>
      )}

      {/* Summary */}
      <SummaryBox
        items={summaryItems}
        color="blue"
        description={summaryDescription}
      />
    </div>
  )
}
