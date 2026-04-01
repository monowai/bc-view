import React, { useEffect, useMemo, useRef, useState } from "react"
import {
  Control,
  Controller,
  FieldErrors,
  useFieldArray,
  useWatch,
  UseFormGetValues,
  UseFormSetValue,
} from "react-hook-form"
import useSwr from "swr"
import { usePrivateAssetConfigs } from "@lib/assets/usePrivateAssetConfigs"
import { useExcludedAssetIds } from "@hooks/useExcludedAssetIds"
import { simpleFetcher } from "@utils/api/fetchHelper"
import { WizardFormData, ContributionFormEntry } from "types/independence"
import { Asset } from "types/beancounter"
import { wizardMessages } from "@lib/independence/messages"
import Spinner from "@components/ui/Spinner"
import { useDefinedContribution } from "../useDefinedContribution"
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
  getValues: UseFormGetValues<WizardFormData>
  setValue: UseFormSetValue<WizardFormData>
  isEditMode?: boolean
}

export default function ContributionsStep({
  control,
  errors,
  getValues,
  setValue,
  isEditMode,
}: ContributionsStepProps): React.ReactElement {
  const { fields, replace } = useFieldArray({
    control,
    name: "contributions",
  })
  const hasInitialized = useRef(false)

  const {
    configs,
    isLoading: configsLoading,
    assetNames,
  } = usePrivateAssetConfigs()

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

  // Filter to only pension/insurance assets, excluding composites
  // (composite assets manage their own sub-account balances)
  const pensionAssets = configs.filter(
    (c) => c.isPension && !(c.subAccounts && c.subAccounts.length > 0),
  )

  const watchedContributions = useWatch({ control, name: "contributions" })
  const contributions = useMemo(
    () => watchedContributions || ([] as ContributionFormEntry[]),
    [watchedContributions],
  )

  // Rental income: watch excluded portfolios and rental asset exclusions
  const watchedExcludedIds = useWatch({
    control,
    name: "excludedPortfolioIds",
  })
  const excludedAssetIds = useExcludedAssetIds(watchedExcludedIds)

  const watchedExcludedRentalIds = useWatch({
    control,
    name: "excludedRentalAssetIds",
  })
  const excludedRentalIds = useMemo(
    () => new Set(watchedExcludedRentalIds || []),
    [watchedExcludedRentalIds],
  )

  const rentalProperties = useMemo(() => {
    if (!configs || configs.length === 0) return []
    return configs.filter(
      (c) =>
        !c.isPrimaryResidence &&
        c.monthlyRentalIncome > 0 &&
        !excludedAssetIds.has(c.assetId),
    )
  }, [configs, excludedAssetIds])

  // Plan currency for FX conversion of rental income
  const planCurrency = useWatch({ control, name: "expensesCurrency" }) || "NZD"

  // Fetch FX rates for rental currencies that differ from plan currency
  const rentalFxPairs = useMemo(() => {
    const currencies = new Set(
      rentalProperties
        .filter((c) => !excludedRentalIds.has(c.assetId))
        .map((c) => c.rentalCurrency)
        .filter((ccy) => ccy !== planCurrency),
    )
    return Array.from(currencies).map((ccy) => ({
      from: ccy,
      to: planCurrency,
    }))
  }, [rentalProperties, excludedRentalIds, planCurrency])

  const fxKey =
    rentalFxPairs.length > 0
      ? `/api/fx?pairs=${rentalFxPairs.map((p) => `${p.from}:${p.to}`).join(",")}`
      : null

  const { data: fxData } = useSwr(
    fxKey,
    fxKey
      ? async () => {
          const res = await fetch("/api/fx", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              rateDate: "today",
              pairs: rentalFxPairs,
            }),
          })
          if (!res.ok) return null
          return res.json()
        }
      : null,
  )

  const fxRates: Record<string, number> = useMemo(() => {
    if (!fxData?.data?.rates) return {}
    const rates: Record<string, number> = {}
    for (const [key, value] of Object.entries(fxData.data.rates)) {
      rates[key] = (value as { rate: number }).rate
    }
    return rates
  }, [fxData])

  // Calculate net rental income per property (in property currency)
  const getNetRentalIncome = (config: (typeof rentalProperties)[0]): number => {
    const percentFee = config.monthlyRentalIncome * config.managementFeePercent
    const effectiveMgmtFee = Math.max(config.monthlyManagementFee, percentFee)
    const monthlyPropertyTax = (config.annualPropertyTax || 0) / 12
    const monthlyInsurance = (config.annualInsurance || 0) / 12
    const totalExpenses =
      effectiveMgmtFee +
      (config.monthlyBodyCorporateFee || 0) +
      monthlyPropertyTax +
      monthlyInsurance +
      (config.monthlyOtherExpenses || 0)
    return Math.max(0, config.monthlyRentalIncome - totalExpenses)
  }

  // Total rental income converted to plan currency
  const totalRentalIncome = useMemo(() => {
    return rentalProperties
      .filter((c) => !excludedRentalIds.has(c.assetId))
      .reduce((sum, config) => {
        const netIncome = getNetRentalIncome(config)
        if (config.rentalCurrency === planCurrency) {
          return sum + netIncome
        }
        const rateKey = `${config.rentalCurrency}:${planCurrency}`
        const rate = fxRates[rateKey] || 1
        return sum + netIncome * rate
      }, 0)
  }, [rentalProperties, excludedRentalIds, planCurrency, fxRates]) // eslint-disable-line react-hooks/exhaustive-deps

  // Watch income-related fields for summary
  const workingIncomeMonthly =
    useWatch({ control, name: "workingIncomeMonthly" }) || 0
  const workingExpensesMonthly =
    useWatch({ control, name: "workingExpensesMonthly" }) || 0
  const taxesMonthly = useWatch({ control, name: "taxesMonthly" }) || 0
  const bonusMonthly = useWatch({ control, name: "bonusMonthly" }) || 0
  const investmentAllocationPercent =
    useWatch({ control, name: "investmentAllocationPercent" }) || 80
  const yearOfBirth = useWatch({ control, name: "yearOfBirth" }) || 0

  // Defined contribution (e.g., CPF) auto-calculation
  const currentYear = new Date().getFullYear()
  const currentAge = yearOfBirth > 0 ? currentYear - yearOfBirth : undefined
  const { data: dcData } = useDefinedContribution(
    workingIncomeMonthly,
    currentAge,
  )
  const [useDC, setUseDC] = useState(true)
  const dcAmount =
    useDC && dcData?.hasDefinedContribution
      ? Math.round(dcData.employeeContribution)
      : 0

  // Initialize contributions with pension assets when data loads
  // Only initialize for NEW plans or when there are no contributions yet
  // Uses getValues() instead of useWatch to avoid race condition where useWatch returns []
  // on first render before defaultValues have propagated through the subscription mechanism
  useEffect(() => {
    if (
      pensionAssets.length > 0 &&
      !hasInitialized.current &&
      assetLookup.size > 0
    ) {
      hasInitialized.current = true
      if ((getValues("contributions") || []).length === 0) {
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
      }
    }
  }, [pensionAssets, replace, getValues, assetLookup])

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
  const netIncomeMonthly =
    workingIncomeMonthly + bonusMonthly - taxesMonthly + totalRentalIncome
  const monthlySurplus = netIncomeMonthly - workingExpensesMonthly
  const surplusAfterContributions = monthlySurplus - grandTotal
  const monthlyInvestment = Math.max(
    0,
    surplusAfterContributions * (investmentAllocationPercent / 100),
  )

  // Investment target after DC deduction
  const investmentTarget = Math.max(0, monthlyInvestment - dcAmount)

  // Summary items for display
  const summaryItems: SummaryItem[] = [
    {
      icon: "fa-money-bill-wave",
      label: "Net Income",
      value: netIncomeMonthly,
      format: "currency",
      valueClassName: "text-green-700",
    },
    ...(totalRentalIncome > 0
      ? [
          {
            icon: "fa-home",
            label: "Property Rental",
            value: totalRentalIncome,
            format: "currency" as const,
            valueClassName: "text-green-700",
          },
        ]
      : []),
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
    ...(dcAmount > 0
      ? [
          {
            icon: "fa-building",
            label: "Defined Contribution",
            value: -dcAmount,
            format: "currency" as const,
            valueClassName: "text-red-600",
          },
          {
            icon: "fa-bullseye",
            label: "Your Investment Target",
            value: investmentTarget,
            format: "currency" as const,
            valueClassName: "text-green-600 font-bold",
          },
        ]
      : []),
  ]

  const summaryDescription =
    surplusAfterContributions < 0
      ? "Your expenses and contributions exceed your net income. Consider adjusting your budget."
      : dcAmount > 0
        ? `After pension contributions and $${dcAmount.toLocaleString()} defined contribution, your independent investment target is $${investmentTarget.toLocaleString()}/month.`
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
      <div className="space-y-4">
        <StepHeader
          title="Income & Contributions"
          description="Enter your current income details and pension contributions."
        />
        <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <Spinner size="4xl" className="text-gray-400 mb-2" />
          <p className="text-gray-500">Loading pension assets...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <StepHeader
        title="Income & Contributions"
        description="Enter your current income details and pension contributions."
      />

      {(!isEditMode || workingIncomeMonthly === 0) && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start">
          <i className="fas fa-check-circle text-green-600 mt-0.5 mr-2"></i>
          <p className="text-sm text-green-700">{msg.skipHint}</p>
        </div>
      )}

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

        {/* Property Rental Income - per property with toggle */}
        {!configsLoading && rentalProperties.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center mb-2">
              <i className="fas fa-home text-green-600 mr-2"></i>
              <h3 className="text-sm font-semibold text-green-800">
                Property Rental Income
              </h3>
            </div>
            <div className="space-y-1">
              {rentalProperties.map((config) => {
                const isExcluded = excludedRentalIds.has(config.assetId)
                const netIncome = getNetRentalIncome(config)
                const name = assetNames[config.assetId] || config.assetId
                const needsConversion = config.rentalCurrency !== planCurrency
                const rateKey = `${config.rentalCurrency}:${planCurrency}`
                const rate = fxRates[rateKey] || 1
                const convertedIncome = needsConversion
                  ? netIncome * rate
                  : netIncome
                return (
                  <label
                    key={config.assetId}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-green-100 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!isExcluded}
                        onChange={() => {
                          const current = watchedExcludedRentalIds || []
                          const updated = isExcluded
                            ? current.filter(
                                (id: string) => id !== config.assetId,
                              )
                            : [...current, config.assetId]
                          setValue("excludedRentalAssetIds", updated)
                        }}
                        className="w-4 h-4 text-green-500 rounded border-gray-300"
                      />
                      <span
                        className={`text-sm ${isExcluded ? "line-through text-gray-400" : "text-green-700"}`}
                      >
                        {name}
                      </span>
                    </div>
                    <span
                      className={`text-sm font-medium ${isExcluded ? "text-gray-400 line-through" : "text-green-600"}`}
                    >
                      {planCurrency}{" "}
                      {Math.round(convertedIncome).toLocaleString()}
                      {needsConversion && (
                        <span className="text-xs text-gray-400 ml-1">
                          ({config.rentalCurrency}{" "}
                          {netIncome.toLocaleString(undefined, {
                            maximumFractionDigits: 0,
                          })}
                          )
                        </span>
                      )}
                    </span>
                  </label>
                )
              })}
            </div>
            <p className="text-xs text-green-600 mt-2">
              <i className="fas fa-info-circle mr-1"></i>
              Net of expenses. Configure in Accounts &gt; Real Estate.
            </p>
          </div>
        )}

        <PercentInput
          name="investmentAllocationPercent"
          label="Investment Allocation"
          helperText="Percentage of your monthly surplus to invest for independence."
          control={control}
          errors={errors}
          step={5}
        />
      </div>

      {/* Defined Contribution Section */}
      {dcData?.hasDefinedContribution && (
        <div className="border-t border-gray-200 pt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-700">Defined Contribution</h3>
            <button
              type="button"
              onClick={() => setUseDC(!useDC)}
              className={`text-sm px-3 py-1 rounded-full border transition-colors ${
                useDC
                  ? "bg-teal-50 border-teal-300 text-teal-700"
                  : "bg-gray-50 border-gray-300 text-gray-500"
              }`}
            >
              {useDC ? "Using DC" : "Ignoring DC"}
            </button>
          </div>
          <div
            className={`p-4 rounded-lg border ${
              useDC
                ? "bg-teal-50 border-teal-200"
                : "bg-gray-50 border-gray-200 opacity-60"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <i className="fas fa-building text-teal-600 mr-3"></i>
                <div>
                  <span className="font-medium text-gray-900">
                    Employee Contribution
                  </span>
                  <span className="ml-2 text-xs px-2 py-0.5 rounded bg-teal-100 text-teal-700">
                    Auto-calculated
                  </span>
                  <p className="text-sm text-gray-500 mt-1">
                    {(dcData.employeeRate * 100).toFixed(1)}% of $
                    {Math.round(dcData.cappedSalary).toLocaleString()} capped
                    salary
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xl font-bold text-teal-700">
                  ${Math.round(dcData.employeeContribution).toLocaleString()}
                </span>
                <p className="text-xs text-gray-500">/month</p>
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            This mandatory contribution is already invested for you. Your
            independent investment target is reduced accordingly.
          </p>
        </div>
      )}

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
                              type="number"
                              min={0}
                              step={50}
                              placeholder="0"
                              value={inputField.value || ""}
                              onChange={(e) =>
                                inputField.onChange(
                                  e.target.value === ""
                                    ? 0
                                    : Number(e.target.value),
                                )
                              }
                              onBlur={inputField.onBlur}
                              ref={inputField.ref}
                              name={inputField.name}
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
