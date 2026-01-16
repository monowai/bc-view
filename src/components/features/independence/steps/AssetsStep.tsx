import React, { useEffect, useMemo, useRef, useCallback } from "react"
import { Control, Controller, useWatch, UseFormSetValue } from "react-hook-form"
import useSwr from "swr"
import { portfoliosKey, simpleFetcher } from "@utils/api/fetchHelper"
import { WizardFormData, ManualAssetCategory } from "types/independence"
import { Portfolio } from "types/beancounter"
import { wizardMessages } from "@lib/independence/messages"

const msg = wizardMessages.steps.assets

// Asset category configuration with labels and growth rate info
const ASSET_CATEGORIES: {
  key: ManualAssetCategory
  label: string
  rateField: "cashReturnRate" | "equityReturnRate" | "housingReturnRate"
  rateLabel: string
}[] = [
  {
    key: "CASH",
    label: wizardMessages.assetCategories.CASH,
    rateField: "cashReturnRate",
    rateLabel: wizardMessages.rateTypes.cash,
  },
  {
    key: "EQUITY",
    label: wizardMessages.assetCategories.EQUITY,
    rateField: "equityReturnRate",
    rateLabel: wizardMessages.rateTypes.equity,
  },
  {
    key: "ETF",
    label: wizardMessages.assetCategories.ETF,
    rateField: "equityReturnRate",
    rateLabel: wizardMessages.rateTypes.equity,
  },
  {
    key: "MUTUAL_FUND",
    label: wizardMessages.assetCategories.MUTUAL_FUND,
    rateField: "equityReturnRate",
    rateLabel: wizardMessages.rateTypes.equity,
  },
  {
    key: "RE",
    label: wizardMessages.assetCategories.RE,
    rateField: "housingReturnRate",
    rateLabel: wizardMessages.rateTypes.housing,
  },
]

// Categories that count as liquid (spendable)
const LIQUID_CATEGORIES: ManualAssetCategory[] = [
  "CASH",
  "EQUITY",
  "ETF",
  "MUTUAL_FUND",
]

interface AssetsStepProps {
  control: Control<WizardFormData>
  setValue: UseFormSetValue<WizardFormData>
}

interface PortfoliosResponse {
  data: Portfolio[]
}

export default function AssetsStep({
  control,
  setValue,
}: AssetsStepProps): React.ReactElement {
  const hasAutoSelected = useRef(false)

  const { data: portfoliosData } = useSwr<PortfoliosResponse>(
    portfoliosKey,
    simpleFetcher(portfoliosKey),
  )

  // Get plan currency from form
  const planCurrency = useWatch({ control, name: "expensesCurrency" }) || "NZD"

  // Filter to only show portfolios with non-zero balance
  const portfoliosWithBalance = useMemo(() => {
    return (portfoliosData?.data || []).filter(
      (p) => p.marketValue && p.marketValue !== 0,
    )
  }, [portfoliosData])

  const watchedPortfolioIds = useWatch({
    control,
    name: "selectedPortfolioIds",
  })
  const selectedPortfolioIds = useMemo(
    () => watchedPortfolioIds || [],
    [watchedPortfolioIds],
  )

  // Auto-select all portfolios with balance when data first loads
  useEffect(() => {
    if (portfoliosWithBalance.length > 0 && !hasAutoSelected.current) {
      const allIds = portfoliosWithBalance.map((p) => p.id)
      setValue("selectedPortfolioIds", allIds)
      hasAutoSelected.current = true
    }
  }, [portfoliosWithBalance, setValue])

  // Watch return rates for display
  const cashReturnRate = useWatch({ control, name: "cashReturnRate" }) ?? 3.5
  const equityReturnRate = useWatch({ control, name: "equityReturnRate" }) ?? 7
  const housingReturnRate =
    useWatch({ control, name: "housingReturnRate" }) ?? 4

  // Watch manual assets for display
  const manualAssets = useWatch({ control, name: "manualAssets" })

  // Calculate liquid and non-spendable totals from manual assets
  const manualAssetTotals = useMemo(() => {
    if (!manualAssets) return { liquid: 0, nonSpendable: 0, total: 0 }
    const liquid = LIQUID_CATEGORIES.reduce(
      (sum, key) => sum + (manualAssets[key] || 0),
      0,
    )
    const nonSpendable = manualAssets.RE || 0
    return { liquid, nonSpendable, total: liquid + nonSpendable }
  }, [manualAssets])

  // Get rate display value for a category
  const getRateForCategory = useCallback(
    (
      rateField: "cashReturnRate" | "equityReturnRate" | "housingReturnRate",
    ) => {
      switch (rateField) {
        case "cashReturnRate":
          return cashReturnRate
        case "equityReturnRate":
          return equityReturnRate
        case "housingReturnRate":
          return housingReturnRate
        default:
          return cashReturnRate
      }
    },
    [cashReturnRate, equityReturnRate, housingReturnRate],
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{msg.title}</h2>
        <p className="text-gray-600">{msg.description}</p>
      </div>

      {/* Portfolio Selection */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-800">
          {msg.selectPortfolios}
        </h3>
        <p className="text-sm text-gray-600">{msg.selectPortfoliosDescription}</p>

        {portfoliosWithBalance.length === 0 ? (
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start">
                <i className="fas fa-info-circle text-yellow-600 mt-0.5 mr-3"></i>
                <div>
                  <p className="font-medium text-yellow-800">{msg.noPortfolios}</p>
                  <p className="text-sm text-yellow-700 mt-1">
                    {msg.noPortfoliosDescription}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ASSET_CATEGORIES.map((category) => (
                <div key={category.key}>
                  <label
                    htmlFor={`manualAssets.${category.key}`}
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    {category.label}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-500">
                      $
                    </span>
                    <Controller
                      name={`manualAssets.${category.key}`}
                      control={control}
                      render={({ field }) => (
                        <input
                          {...field}
                          id={`manualAssets.${category.key}`}
                          type="number"
                          min={0}
                          step={1000}
                          value={field.value || 0}
                          onChange={(e) =>
                            field.onChange(Number(e.target.value) || 0)
                          }
                          className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        />
                      )}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {msg.growsAt
                      .replace("{rate}", String(getRateForCategory(category.rateField)))
                      .replace("{type}", category.rateLabel)}
                  </p>
                </div>
              ))}
            </div>

            {manualAssetTotals.total > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-blue-700">{msg.liquidAssets}</span>
                  <span className="font-medium text-blue-800">
                    {planCurrency} {manualAssetTotals.liquid.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-blue-700">{msg.realEstate}</span>
                  <span className="font-medium text-blue-800">
                    {planCurrency}{" "}
                    {manualAssetTotals.nonSpendable.toLocaleString()}
                  </span>
                </div>
                <div className="border-t border-blue-200 pt-2 flex justify-between items-center">
                  <div className="flex items-center">
                    <i className="fas fa-chart-pie text-blue-600 mr-2"></i>
                    <span className="font-medium text-blue-800">
                      {msg.totalAssets}
                    </span>
                  </div>
                  <span className="text-xl font-bold text-blue-700">
                    {planCurrency} {manualAssetTotals.total.toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {portfoliosWithBalance.map((portfolio) => (
              <Controller
                key={portfolio.id}
                name="selectedPortfolioIds"
                control={control}
                render={({ field }) => (
                  <label className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={field.value?.includes(portfolio.id) || false}
                      onChange={(e) => {
                        const current = field.value || []
                        if (e.target.checked) {
                          field.onChange([...current, portfolio.id])
                        } else {
                          field.onChange(
                            current.filter((id: string) => id !== portfolio.id),
                          )
                        }
                      }}
                      className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                    />
                    <div className="ml-3 flex-1">
                      <span className="font-medium text-gray-900">
                        {portfolio.code}
                      </span>
                      <span className="text-gray-500 ml-2">{portfolio.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-gray-700 font-medium">
                        {portfolio.base?.code || portfolio.currency?.code}{" "}
                        {Math.round(portfolio.marketValue || 0).toLocaleString()}
                      </span>
                    </div>
                  </label>
                )}
              />
            ))}
          </div>
        )}

        {selectedPortfolioIds.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <i className="fas fa-chart-pie text-blue-600 mr-3"></i>
                <div>
                  <span className="font-medium text-blue-800">
                    {selectedPortfolioIds.length}{" "}
                    {selectedPortfolioIds.length > 1
                      ? msg.portfoliosSelectedPlural
                      : msg.portfoliosSelected}{" "}
                    {msg.selected}
                  </span>
                  <p className="text-xs text-blue-600">
                    {msg.conversionNote.replace("{currency}", planCurrency)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
