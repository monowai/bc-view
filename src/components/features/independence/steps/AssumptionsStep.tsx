import React, { useEffect, useMemo, useRef, useState, useCallback } from "react"
import {
  Control,
  Controller,
  FieldErrors,
  useWatch,
  UseFormSetValue,
} from "react-hook-form"
import { WizardFormData } from "types/independence"
import { AllocationResponse } from "types/beancounter"
import { wizardMessages } from "@lib/independence/messages"

const msg = wizardMessages.steps.assumptions
const fields = wizardMessages.fields

interface AssumptionsStepProps {
  control: Control<WizardFormData>
  errors: FieldErrors<WizardFormData>
  setValue: UseFormSetValue<WizardFormData>
}

export default function AssumptionsStep({
  control,
  errors,
  setValue,
}: AssumptionsStepProps): React.ReactElement {
  const hasAppliedAllocation = useRef(false)
  const [isLoadingAllocation, setIsLoadingAllocation] = useState(false)

  const watchedPortfolioIds = useWatch({
    control,
    name: "selectedPortfolioIds",
  })
  const selectedPortfolioIds = useMemo(
    () => watchedPortfolioIds || [],
    [watchedPortfolioIds],
  )

  // Watch current allocation values to determine if they're already set
  const currentCashAllocation =
    useWatch({ control, name: "cashAllocation" }) ?? 0
  const currentEquityAllocation =
    useWatch({ control, name: "equityAllocation" }) ?? 0
  const currentHousingAllocation =
    useWatch({ control, name: "housingAllocation" }) ?? 0

  // Only auto-apply actual allocation if all values are 0 (not set)
  // This preserves user-saved allocations when editing a plan
  const hasExistingAllocation =
    currentCashAllocation > 0 ||
    currentEquityAllocation > 0 ||
    currentHousingAllocation > 0

  // Fetch and apply allocation data when portfolios are first selected
  // but ONLY if allocations are not already set (all are 0)
  useEffect(() => {
    if (
      selectedPortfolioIds.length === 0 ||
      hasAppliedAllocation.current ||
      hasExistingAllocation
    )
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
  }, [selectedPortfolioIds, setValue, hasExistingAllocation])

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
          {msg.title}
        </h2>
        <p className="text-gray-600">{msg.description}</p>
      </div>

      {/* Return Rate Assumptions */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-800">
          {msg.returnAssumptions}
        </h3>
        <p className="text-sm text-gray-600">
          {msg.returnAssumptionsDescription}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="equityReturnRate"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {fields.equityReturnRate}
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
              {fields.cashReturnRate}
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
              {fields.housingReturnRate}
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
              {fields.inflationRate}
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
              {msg.assetAllocation}
            </h3>
            <p className="text-sm text-gray-600">
              {msg.assetAllocationDescription}
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
                  {msg.loading}
                </>
              ) : (
                <>
                  <i className="fas fa-sync-alt mr-2"></i>
                  {msg.useActual}
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
              {fields.equityAllocation}
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
              {fields.cashAllocation}
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
              {fields.housingAllocation}
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
                  {msg.totalAllocation}: {totalAllocation}%
                </span>
                {totalAllocation !== 100 && (
                  <p className="text-sm text-yellow-700">
                    {msg.allocationWarning}
                  </p>
                )}
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm text-gray-600">{msg.blendedReturn}</span>
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
          {msg.targetBalance}
        </h3>
        <p className="text-sm text-gray-600">{msg.targetBalanceDescription}</p>

        <div>
          <label
            htmlFor="targetBalance"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {msg.targetBalance}
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
                  placeholder={msg.targetBalancePlaceholder}
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
