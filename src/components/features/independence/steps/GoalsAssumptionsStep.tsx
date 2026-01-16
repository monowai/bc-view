import React, { useEffect, useMemo, useRef, useState, useCallback } from "react"
import {
  Control,
  Controller,
  FieldErrors,
  useWatch,
  UseFormSetValue,
} from "react-hook-form"
import useSwr from "swr"
import { portfoliosKey, simpleFetcher } from "@utils/api/fetchHelper"
import { WizardFormData, ManualAssetCategory } from "types/independence"
import { Portfolio, AllocationResponse } from "types/beancounter"

// Asset category configuration with labels and growth rate info
const ASSET_CATEGORIES: {
  key: ManualAssetCategory
  label: string
  rateField: "cashReturnRate" | "equityReturnRate" | "housingReturnRate"
  rateLabel: string
}[] = [
  {
    key: "CASH",
    label: "Cash & Savings",
    rateField: "cashReturnRate",
    rateLabel: "cash",
  },
  {
    key: "EQUITY",
    label: "Equities (Stocks)",
    rateField: "equityReturnRate",
    rateLabel: "equity",
  },
  {
    key: "ETF",
    label: "ETFs",
    rateField: "equityReturnRate",
    rateLabel: "equity",
  },
  {
    key: "MUTUAL_FUND",
    label: "Mutual Funds",
    rateField: "equityReturnRate",
    rateLabel: "equity",
  },
  {
    key: "RE",
    label: "Real Estate",
    rateField: "housingReturnRate",
    rateLabel: "housing",
  },
]

// Categories that count as liquid (spendable)
const LIQUID_CATEGORIES: ManualAssetCategory[] = [
  "CASH",
  "EQUITY",
  "ETF",
  "MUTUAL_FUND",
]

interface GoalsAssumptionsStepProps {
  control: Control<WizardFormData>
  errors: FieldErrors<WizardFormData>
  setValue: UseFormSetValue<WizardFormData>
}

interface PortfoliosResponse {
  data: Portfolio[]
}

export default function GoalsAssumptionsStep({
  control,
  errors,
  setValue,
}: GoalsAssumptionsStepProps): React.ReactElement {
  const hasAutoSelected = useRef(false)
  const hasAppliedAllocation = useRef(false)
  const [isLoadingAllocation, setIsLoadingAllocation] = useState(false)

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

  // Fetch and apply allocation data when portfolios are first selected
  useEffect(() => {
    if (selectedPortfolioIds.length === 0 || hasAppliedAllocation.current)
      return

    setIsLoadingAllocation(true)
    const ids = selectedPortfolioIds.join(",")

    fetch(`/api/holdings/allocation?asAt=today&ids=${encodeURIComponent(ids)}`)
      .then((res) => res.json())
      .then((response: AllocationResponse) => {
        if (response.data) {
          const { cashAllocation, equityAllocation, housingAllocation } =
            response.data
          // Only apply if we have meaningful allocation data
          const total = cashAllocation + equityAllocation + housingAllocation
          if (total > 0) {
            // Round to nearest integer for cleaner display
            setValue("cashAllocation", Math.round(cashAllocation))
            setValue("equityAllocation", Math.round(equityAllocation))
            setValue("housingAllocation", Math.round(housingAllocation))
            hasAppliedAllocation.current = true
          }
        }
      })
      .catch(console.error)
      .finally(() => setIsLoadingAllocation(false))
  }, [selectedPortfolioIds, setValue])

  // Function to refresh allocation from selected portfolios
  const refreshAllocation = useCallback((): void => {
    if (selectedPortfolioIds.length === 0) return

    setIsLoadingAllocation(true)
    const ids = selectedPortfolioIds.join(",")

    fetch(`/api/holdings/allocation?asAt=today&ids=${encodeURIComponent(ids)}`)
      .then((res) => res.json())
      .then((response: AllocationResponse) => {
        if (response.data) {
          const { cashAllocation, equityAllocation, housingAllocation } =
            response.data
          const total = cashAllocation + equityAllocation + housingAllocation
          if (total > 0) {
            setValue("cashAllocation", Math.round(cashAllocation))
            setValue("equityAllocation", Math.round(equityAllocation))
            setValue("housingAllocation", Math.round(housingAllocation))
          }
        }
      })
      .catch(console.error)
      .finally(() => setIsLoadingAllocation(false))
  }, [selectedPortfolioIds, setValue])

  // Watch allocation and return values to calculate blended return
  // Use nullish coalescing (??) instead of || to allow 0 as a valid value
  const cashAllocation = useWatch({ control, name: "cashAllocation" }) ?? 20
  const equityAllocation = useWatch({ control, name: "equityAllocation" }) ?? 60
  const housingAllocation =
    useWatch({ control, name: "housingAllocation" }) ?? 20
  const cashReturnRate = useWatch({ control, name: "cashReturnRate" }) ?? 3.5
  const equityReturnRate = useWatch({ control, name: "equityReturnRate" }) ?? 7
  const housingReturnRate =
    useWatch({ control, name: "housingReturnRate" }) ?? 4

  const totalAllocation = cashAllocation + equityAllocation + housingAllocation

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
  const blendedReturn = useMemo(() => {
    return (
      (cashAllocation / 100) * cashReturnRate +
      (equityAllocation / 100) * equityReturnRate +
      (housingAllocation / 100) * housingReturnRate
    ).toFixed(2)
  }, [
    cashAllocation,
    equityAllocation,
    housingAllocation,
    cashReturnRate,
    equityReturnRate,
    housingReturnRate,
  ])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Goals & Assumptions
        </h2>
        <p className="text-gray-600">
          Set your financial assumptions and select which portfolios to include
          in your independence planning.
        </p>
      </div>

      {/* Portfolio Selection */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-800">Select Portfolios</h3>
        <p className="text-sm text-gray-600">
          Choose which portfolios to include in your independence asset
          calculation.
        </p>

        {portfoliosWithBalance.length === 0 ? (
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start">
                <i className="fas fa-info-circle text-yellow-600 mt-0.5 mr-3"></i>
                <div>
                  <p className="font-medium text-yellow-800">
                    No portfolios found
                  </p>
                  <p className="text-sm text-yellow-700 mt-1">
                    Enter your current asset values by category below. Growth
                    rates will be applied based on your assumptions.
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
                    Grows at {getRateForCategory(category.rateField)}% (
                    {category.rateLabel} rate)
                  </p>
                </div>
              ))}
            </div>

            {manualAssetTotals.total > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-blue-700">
                    Liquid Assets (spendable)
                  </span>
                  <span className="font-medium text-blue-800">
                    {planCurrency} {manualAssetTotals.liquid.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-blue-700">
                    Real Estate (non-spendable)
                  </span>
                  <span className="font-medium text-blue-800">
                    {planCurrency}{" "}
                    {manualAssetTotals.nonSpendable.toLocaleString()}
                  </span>
                </div>
                <div className="border-t border-blue-200 pt-2 flex justify-between items-center">
                  <div className="flex items-center">
                    <i className="fas fa-chart-pie text-blue-600 mr-2"></i>
                    <span className="font-medium text-blue-800">
                      Total Assets
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
                      <span className="text-gray-500 ml-2">
                        {portfolio.name}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-gray-700 font-medium">
                        {portfolio.base?.code || portfolio.currency?.code}{" "}
                        {Math.round(
                          portfolio.marketValue || 0,
                        ).toLocaleString()}
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
                    {selectedPortfolioIds.length} Portfolio
                    {selectedPortfolioIds.length > 1 ? "s" : ""} Selected
                  </span>
                  <p className="text-xs text-blue-600">
                    Values will be converted to {planCurrency} for projections
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Return Rate Assumptions */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-800">
          Return Assumptions
        </h3>
        <p className="text-sm text-gray-600">
          Set expected annual return rates for different asset classes.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="equityReturnRate"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Equity Return Rate (%)
            </label>
            <Controller
              name="equityReturnRate"
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  id="equityReturnRate"
                  type="number"
                  min={0}
                  max={30}
                  step={0.5}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  className={`
                    w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500
                    ${errors.equityReturnRate ? "border-red-500" : "border-gray-300"}
                  `}
                />
              )}
            />
            {errors.equityReturnRate && (
              <p className="mt-1 text-sm text-red-600">
                {errors.equityReturnRate.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="cashReturnRate"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Cash Return Rate (%)
            </label>
            <Controller
              name="cashReturnRate"
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  id="cashReturnRate"
                  type="number"
                  min={0}
                  max={20}
                  step={0.5}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  className={`
                    w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500
                    ${errors.cashReturnRate ? "border-red-500" : "border-gray-300"}
                  `}
                />
              )}
            />
            {errors.cashReturnRate && (
              <p className="mt-1 text-sm text-red-600">
                {errors.cashReturnRate.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="housingReturnRate"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Housing Return Rate (%)
            </label>
            <Controller
              name="housingReturnRate"
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  id="housingReturnRate"
                  type="number"
                  min={0}
                  max={20}
                  step={0.5}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  className={`
                    w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500
                    ${errors.housingReturnRate ? "border-red-500" : "border-gray-300"}
                  `}
                />
              )}
            />
            {errors.housingReturnRate && (
              <p className="mt-1 text-sm text-red-600">
                {errors.housingReturnRate.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="inflationRate"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Inflation Rate (%)
            </label>
            <Controller
              name="inflationRate"
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  id="inflationRate"
                  type="number"
                  min={0}
                  max={10}
                  step={0.5}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  className={`
                    w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500
                    ${errors.inflationRate ? "border-red-500" : "border-gray-300"}
                  `}
                />
              )}
            />
            {errors.inflationRate && (
              <p className="mt-1 text-sm text-red-600">
                {errors.inflationRate.message}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Asset Allocation */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-800">
              Asset Allocation
            </h3>
            <p className="text-sm text-gray-600">
              Set your target asset allocation. This determines the blended
              return used in projections.
            </p>
          </div>
          {selectedPortfolioIds.length > 0 && (
            <button
              type="button"
              onClick={refreshAllocation}
              disabled={isLoadingAllocation}
              className="flex items-center px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-50"
            >
              {isLoadingAllocation ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Loading...
                </>
              ) : (
                <>
                  <i className="fas fa-sync-alt mr-2"></i>
                  Use Actual
                </>
              )}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="equityAllocation"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Equities (%)
            </label>
            <Controller
              name="equityAllocation"
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  id="equityAllocation"
                  type="number"
                  min={0}
                  max={100}
                  step={5}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  className={`
                    w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500
                    ${errors.equityAllocation ? "border-red-500" : "border-gray-300"}
                  `}
                />
              )}
            />
            {errors.equityAllocation && (
              <p className="mt-1 text-sm text-red-600">
                {errors.equityAllocation.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="cashAllocation"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Cash (%)
            </label>
            <Controller
              name="cashAllocation"
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  id="cashAllocation"
                  type="number"
                  min={0}
                  max={100}
                  step={5}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  className={`
                    w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500
                    ${errors.cashAllocation ? "border-red-500" : "border-gray-300"}
                  `}
                />
              )}
            />
            {errors.cashAllocation && (
              <p className="mt-1 text-sm text-red-600">
                {errors.cashAllocation.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="housingAllocation"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Housing (%)
            </label>
            <Controller
              name="housingAllocation"
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  id="housingAllocation"
                  type="number"
                  min={0}
                  max={100}
                  step={5}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  className={`
                    w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500
                    ${errors.housingAllocation ? "border-red-500" : "border-gray-300"}
                  `}
                />
              )}
            />
            {errors.housingAllocation && (
              <p className="mt-1 text-sm text-red-600">
                {errors.housingAllocation.message}
              </p>
            )}
          </div>
        </div>

        <div
          className={`rounded-lg p-4 ${totalAllocation === 100 ? "bg-green-50 border border-green-200" : "bg-yellow-50 border border-yellow-200"}`}
        >
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <i
                className={`fas ${totalAllocation === 100 ? "fa-check-circle text-green-600" : "fa-exclamation-triangle text-yellow-600"} mr-3`}
              ></i>
              <div>
                <span
                  className={`font-medium ${totalAllocation === 100 ? "text-green-800" : "text-yellow-800"}`}
                >
                  Total Allocation: {totalAllocation}%
                </span>
                {totalAllocation !== 100 && (
                  <p className="text-sm text-yellow-700">
                    Allocation should equal 100%
                  </p>
                )}
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm text-gray-600">Blended Return</span>
              <p className="text-xl font-bold text-gray-900">
                {blendedReturn}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Target Balance */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-800">
          Target Balance (Optional)
        </h3>
        <p className="text-sm text-gray-600">
          Set a target ending balance if you want to leave a legacy or buffer.
        </p>

        <div>
          <label
            htmlFor="targetBalance"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Target Ending Balance
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-gray-500">$</span>
            <Controller
              name="targetBalance"
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  id="targetBalance"
                  type="number"
                  min={0}
                  step={10000}
                  value={field.value || ""}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value ? Number(e.target.value) : undefined,
                    )
                  }
                  placeholder="Leave blank for $0 target"
                  className={`
                    w-full pl-8 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500
                    ${errors.targetBalance ? "border-red-500" : "border-gray-300"}
                  `}
                />
              )}
            />
          </div>
          {errors.targetBalance && (
            <p className="mt-1 text-sm text-red-600">
              {errors.targetBalance.message}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
